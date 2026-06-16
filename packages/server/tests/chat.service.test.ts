import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub entity modules — their TypeORM decorators require emitDecoratorMetadata
// which vitest's esbuild transformer does not emit. The service only uses
// the symbols as DI tokens, never instantiates the classes directly.
vi.mock('../src/chat/entities/chat-session.entity.js', () => ({
  ChatSession: class ChatSession {},
}));
vi.mock('../src/chat/entities/chat-message.entity.js', () => ({
  ChatMessage: class ChatMessage {},
}));

const { NotFoundException } = await import('@nestjs/common');
const { ChatService } = await import('../src/chat/chat.service.js');

type AnyFn = ReturnType<typeof vi.fn>;

function makeSessionRepo() {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    save: vi.fn(async (x) => ({ id: x.id ?? 'sess-1', ...x })),
    create: vi.fn((x) => x),
    remove: vi.fn(async () => undefined),
  };
}

function makeMessageRepo() {
  return {
    find: vi.fn(),
    save: vi.fn(async (x) => ({ id: x.id ?? `msg-${Math.random()}`, ...x })),
    create: vi.fn((x) => x),
    createQueryBuilder: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([]),
    })),
  };
}

function makeLlm() {
  return { streamToProviders: vi.fn() as AnyFn };
}

describe('ChatService.createSession', () => {
  it('uses the provided title', async () => {
    const sessions = makeSessionRepo();
    const service = new ChatService(sessions as never, makeMessageRepo() as never, makeLlm() as never);
    await service.createSession({ title: 'My Chat' });
    expect(sessions.create).toHaveBeenCalledWith({ title: 'My Chat' });
  });

  it('defaults to "New Chat" when no title is supplied', async () => {
    const sessions = makeSessionRepo();
    const service = new ChatService(sessions as never, makeMessageRepo() as never, makeLlm() as never);
    await service.createSession({} as never);
    expect(sessions.create).toHaveBeenCalledWith({ title: 'New Chat' });
  });
});

describe('ChatService.listSessions', () => {
  it('joins message counts onto each session, defaulting missing counts to 0', async () => {
    const sessions = makeSessionRepo();
    const messages = makeMessageRepo();
    sessions.find.mockResolvedValue([
      { id: 'a', title: 'A', createdAt: new Date(0), updatedAt: new Date(1) },
      { id: 'b', title: 'B', createdAt: new Date(2), updatedAt: new Date(3) },
    ]);
    messages.createQueryBuilder.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([{ sessionId: 'a', count: '3' }]),
    } as never);
    const service = new ChatService(sessions as never, messages as never, makeLlm() as never);
    const out = await service.listSessions();
    expect(out).toEqual([
      { id: 'a', title: 'A', createdAt: new Date(0), updatedAt: new Date(1), messageCount: 3 },
      { id: 'b', title: 'B', createdAt: new Date(2), updatedAt: new Date(3), messageCount: 0 },
    ]);
  });
});

describe('ChatService.getSession', () => {
  it('throws NotFoundException when the session is missing', async () => {
    const sessions = makeSessionRepo();
    sessions.findOne.mockResolvedValue(null);
    const service = new ChatService(sessions as never, makeMessageRepo() as never, makeLlm() as never);
    await expect(service.getSession('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the session merged with its messages in chronological order', async () => {
    const sessions = makeSessionRepo();
    const messages = makeMessageRepo();
    sessions.findOne.mockResolvedValue({ id: 'a', title: 'A' });
    messages.find.mockResolvedValue([{ id: 'm1', role: 'user', content: 'hi' }]);
    const service = new ChatService(sessions as never, messages as never, makeLlm() as never);
    const out = await service.getSession('a');
    expect(messages.find).toHaveBeenCalledWith({
      where: { sessionId: 'a' },
      order: { createdAt: 'ASC' },
    });
    expect(out).toMatchObject({ id: 'a', title: 'A', messages: [{ id: 'm1' }] });
  });
});

describe('ChatService.updateSession / deleteSession', () => {
  it('updateSession throws when missing and otherwise persists the new title', async () => {
    const sessions = makeSessionRepo();
    sessions.findOne.mockResolvedValueOnce(null);
    const service = new ChatService(sessions as never, makeMessageRepo() as never, makeLlm() as never);
    await expect(service.updateSession('x', { title: 'T' })).rejects.toBeInstanceOf(NotFoundException);

    const existing = { id: 'x', title: 'old' };
    sessions.findOne.mockResolvedValueOnce(existing);
    await service.updateSession('x', { title: 'new' });
    expect(existing.title).toBe('new');
    expect(sessions.save).toHaveBeenCalledWith(existing);
  });

  it('deleteSession throws when missing and otherwise removes the row', async () => {
    const sessions = makeSessionRepo();
    sessions.findOne.mockResolvedValueOnce(null);
    const service = new ChatService(sessions as never, makeMessageRepo() as never, makeLlm() as never);
    await expect(service.deleteSession('x')).rejects.toBeInstanceOf(NotFoundException);

    const existing = { id: 'x' };
    sessions.findOne.mockResolvedValueOnce(existing);
    await service.deleteSession('x');
    expect(sessions.remove).toHaveBeenCalledWith(existing);
  });
});

describe('ChatService.sendMessage', () => {
  function makeRes() {
    return {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    };
  }

  it('throws NotFoundException when the session does not exist', async () => {
    const sessions = makeSessionRepo();
    sessions.findOne.mockResolvedValue(null);
    const service = new ChatService(sessions as never, makeMessageRepo() as never, makeLlm() as never);
    await expect(
      service.sendMessage('missing', { content: 'hi', providers: ['openai'] }, makeRes() as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('auto-titles the session from the first user message (truncated at 60 chars)', async () => {
    const sessions = makeSessionRepo();
    const messages = makeMessageRepo();
    const llm = makeLlm();
    const session = { id: 's1', title: 'New Chat' };
    sessions.findOne.mockResolvedValue(session);
    messages.find.mockResolvedValue([]);
    llm.streamToProviders.mockResolvedValue(undefined);

    const service = new ChatService(sessions as never, messages as never, llm as never);
    const longContent = 'A'.repeat(80);
    await service.sendMessage('s1', { content: longContent, providers: ['openai'] }, makeRes() as never);

    expect(session.title).toBe('A'.repeat(60) + '…');
    expect(sessions.save).toHaveBeenCalledWith(session);
  });

  it('does not retitle a session that already has a custom title', async () => {
    const sessions = makeSessionRepo();
    const messages = makeMessageRepo();
    const llm = makeLlm();
    const session = { id: 's1', title: 'Existing title' };
    sessions.findOne.mockResolvedValue(session);
    messages.find.mockResolvedValue([]);
    llm.streamToProviders.mockResolvedValue(undefined);

    const service = new ChatService(sessions as never, messages as never, llm as never);
    await service.sendMessage('s1', { content: 'hello', providers: ['openai'] }, makeRes() as never);

    expect(session.title).toBe('Existing title');
  });

  it('writes SSE headers and emits a userMessage event before streaming', async () => {
    const sessions = makeSessionRepo();
    const messages = makeMessageRepo();
    const llm = makeLlm();
    const res = makeRes();
    sessions.findOne.mockResolvedValue({ id: 's1', title: 'x' });
    messages.find.mockResolvedValue([]);
    llm.streamToProviders.mockResolvedValue(undefined);
    messages.save.mockResolvedValueOnce({ id: 'user-1', createdAt: new Date(0), content: 'hi' });

    const service = new ChatService(sessions as never, messages as never, llm as never);
    await service.sendMessage('s1', { content: 'hi', providers: ['openai'] }, res as never);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.flushHeaders).toHaveBeenCalled();
    const firstWrite = res.write.mock.calls[0][0] as string;
    expect(firstWrite).toContain('event: userMessage');
    expect(firstWrite).toContain('"id":"user-1"');
    expect(res.end).toHaveBeenCalled();
  });
});
