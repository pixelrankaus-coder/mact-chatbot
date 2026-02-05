export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ConversationStatus = "active" | "pending" | "resolved";
export type SenderType = "visitor" | "ai" | "agent" | "system";
export type KnowledgeBaseStatus = "processing" | "ready" | "error";

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: {
          id: string;
          visitor_id: string;
          visitor_name: string | null;
          visitor_email: string | null;
          visitor_phone: string | null;
          visitor_location: string | null;
          status: ConversationStatus;
          assigned_to: string | null;
          metadata: Json | null;
          rating: number | null;
          rating_feedback: string | null;
          created_at: string;
          updated_at: string;
          // Task 043: Auto-resolve fields
          resolved_at: string | null;
          last_activity_at: string;
        };
        Insert: {
          id?: string;
          visitor_id: string;
          visitor_name?: string | null;
          visitor_email?: string | null;
          visitor_phone?: string | null;
          visitor_location?: string | null;
          status?: ConversationStatus;
          assigned_to?: string | null;
          metadata?: Json | null;
          rating?: number | null;
          rating_feedback?: string | null;
          created_at?: string;
          updated_at?: string;
          // Task 043: Auto-resolve fields
          resolved_at?: string | null;
          last_activity_at?: string;
        };
        Update: {
          id?: string;
          visitor_id?: string;
          visitor_name?: string | null;
          visitor_email?: string | null;
          visitor_phone?: string | null;
          visitor_location?: string | null;
          status?: ConversationStatus;
          assigned_to?: string | null;
          metadata?: Json | null;
          rating?: number | null;
          rating_feedback?: string | null;
          created_at?: string;
          updated_at?: string;
          // Task 043: Auto-resolve fields
          resolved_at?: string | null;
          last_activity_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_type: SenderType;
          sender_name: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_type: SenderType;
          sender_name: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_type?: SenderType;
          sender_name?: string;
          content?: string;
          created_at?: string;
        };
      };
      knowledge_base: {
        Row: {
          id: string;
          filename: string;
          file_type: string;
          file_size: number;
          content: string | null;
          status: KnowledgeBaseStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          filename: string;
          file_type: string;
          file_size: number;
          content?: string | null;
          status?: KnowledgeBaseStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          filename?: string;
          file_type?: string;
          file_size?: number;
          content?: string | null;
          status?: KnowledgeBaseStatus;
          created_at?: string;
        };
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: Json;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: "owner" | "admin" | "agent";
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          role?: "owner" | "admin" | "agent";
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: "owner" | "admin" | "agent";
          avatar_url?: string | null;
          created_at?: string;
        };
      };
      agents: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          role: "owner" | "admin" | "agent";
          is_online: boolean;
          last_seen_at: string | null;
          operating_hours: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          avatar_url?: string | null;
          role?: "owner" | "admin" | "agent";
          is_online?: boolean;
          last_seen_at?: string | null;
          operating_hours?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          avatar_url?: string | null;
          role?: "owner" | "admin" | "agent";
          is_online?: boolean;
          last_seen_at?: string | null;
          operating_hours?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      conversation_status: ConversationStatus;
      sender_type: SenderType;
      knowledge_base_status: KnowledgeBaseStatus;
      user_role: "owner" | "admin" | "agent";
    };
  };
}
