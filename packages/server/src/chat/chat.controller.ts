import {
  Controller, Get, Post, Patch, Delete, Param, Body, Res, HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { UpdateSessionDto } from './dto/update-session.dto.js';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  listSessions() {
    return this.chatService.listSessions();
  }

  @Post()
  createSession(@Body() dto: CreateSessionDto) {
    return this.chatService.createSession(dto);
  }

  @Get(':id')
  getSession(@Param('id') id: string) {
    return this.chatService.getSession(id);
  }

  @Patch(':id')
  updateSession(@Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.chatService.updateSession(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteSession(@Param('id') id: string) {
    return this.chatService.deleteSession(id);
  }

  @Post(':id/messages')
  sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    return this.chatService.sendMessage(id, dto, res);
  }
}
