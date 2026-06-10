import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany, Relation,
} from 'typeorm';
import { ChatMessage } from './chat-message.entity.js';

@Entity('chat_sessions')
export class ChatSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'New Chat' })
  title: string;

  @OneToMany(() => ChatMessage, (msg) => msg.session, { cascade: true })
  messages: Relation<ChatMessage[]>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
