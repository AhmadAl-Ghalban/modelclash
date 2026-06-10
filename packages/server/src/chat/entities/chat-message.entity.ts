import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { ChatSession } from './chat-session.entity.js';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @ManyToOne(() => ChatSession, (session) => session.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: ChatSession;

  @Column({ type: 'varchar' })
  role: 'user' | 'assistant' | 'error';

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  provider: string;

  @Column({ nullable: true })
  model: string;

  @Column({ type: 'float', nullable: true })
  costUsd: number;

  @Column({ type: 'int', nullable: true })
  tokens: number;

  @Column({ type: 'int', nullable: true })
  durationMs: number;

  @CreateDateColumn()
  createdAt: Date;
}
