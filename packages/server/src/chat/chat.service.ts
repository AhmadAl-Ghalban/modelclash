import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { ChatSession } from './entities/chat-session.entity.js';
import { ChatMessage } from './entities/chat-message.entity.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { UpdateSessionDto } from './dto/update-session.dto.js';
import { LlmService, CoreProviderResult } from '../llm/llm.service.js';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSession)
    private sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private messageRepo: Repository<ChatMessage>,
    private llmService: LlmService,
  ) {}

  async listSessions() {
    const sessions = await this.sessionRepo.find({
      order: { updatedAt: 'DESC' },
    });
    const counts = await this.messageRepo
      .createQueryBuilder('m')
      .select('m.sessionId', 'sessionId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('m.sessionId')
      .getRawMany();
    const countMap = Object.fromEntries(counts.map((c) => [c.sessionId, parseInt(c.count)]));
    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: countMap[s.id] || 0,
    }));
  }

  async createSession(dto: CreateSessionDto) {
    const session = this.sessionRepo.create({ title: dto.title || 'New Chat' });
    return this.sessionRepo.save(session);
  }

  async getSession(id: string) {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    const messages = await this.messageRepo.find({
      where: { sessionId: id },
      order: { createdAt: 'ASC' },
    });
    return { ...session, messages };
  }

  async updateSession(id: string, dto: UpdateSessionDto) {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    session.title = dto.title;
    return this.sessionRepo.save(session);
  }

  async deleteSession(id: string) {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    await this.sessionRepo.remove(session);
  }

  async sendMessage(sessionId: string, dto: SendMessageDto, res: Response) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    // Save user message
    const userMsg = await this.messageRepo.save(
      this.messageRepo.create({ sessionId, role: 'user', content: dto.content }),
    );

    // Auto-title session on first message
    if (session.title === 'New Chat') {
      session.title = dto.content.slice(0, 60) + (dto.content.length > 60 ? '…' : '');
      await this.sessionRepo.save(session);
    }

    // Get history for context — interleave user msgs with one assistant reply per turn
    const history = await this.messageRepo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
    const historyForLlm: { role: 'user' | 'assistant'; content: string }[] = [];
    let seenAssistantForTurn = false;
    for (const m of history) {
      if (m.id === userMsg.id) break; // stop before current message
      if (m.role === 'user') {
        historyForLlm.push({ role: 'user', content: m.content });
        seenAssistantForTurn = false;
      } else if (m.role === 'assistant' && !seenAssistantForTurn) {
        historyForLlm.push({ role: 'assistant', content: m.content });
        seenAssistantForTurn = true;
      }
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('userMessage', { message: { id: userMsg.id, role: 'user', content: dto.content, createdAt: userMsg.createdAt } });

    const savedMessages: ChatMessage[] = [];

    await this.llmService.streamToProviders(
      dto.content,
      historyForLlm.slice(0, -1), // exclude the current user message (it's in prompt)
      dto.providers,
      (provider, chunk) => sendEvent('chunk', { provider, text: chunk }),
      async (result: CoreProviderResult) => {
        let fields;
        if (result.ok) {
          const v = result.value;
          fields = {
            sessionId,
            role: 'assistant' as const,
            content: v.text,
            provider: v.provider,
            model: v.model,
            costUsd: v.costUsd,
            tokens: v.usage.total,
            durationMs: v.durationMs,
          };
        } else {
          const e = (result as Extract<CoreProviderResult, { ok: false }>).error;
          fields = {
            sessionId,
            role: 'error' as const,
            content: e.message,
            provider: e.provider,
            model: e.model,
            costUsd: undefined,
            tokens: undefined,
            durationMs: e.durationMs,
          };
          sendEvent('providerError', { provider: e.provider, message: e.message });
        }
        const entity = this.messageRepo.create(fields as Partial<ChatMessage>);
        const msg = await this.messageRepo.save(entity);
        savedMessages.push(msg);
      },
    );

    sendEvent('complete', { messages: savedMessages });
    res.end();
  }
}
