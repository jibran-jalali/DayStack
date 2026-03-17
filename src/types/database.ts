export type Json =
  | string
  | number
  | boolean
  | null
  | {
      [key: string]: Json | undefined;
    }
  | Json[];

export type Database = {
  public: {
    Tables: {
      daily_summaries: {
        Row: {
          completed_tasks: number;
          created_at: string;
          execution_score: number;
          id: string;
          successful_day: boolean;
          summary_date: string;
          total_tasks: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_tasks?: number;
          created_at?: string;
          execution_score?: number;
          id?: string;
          successful_day?: boolean;
          summary_date: string;
          total_tasks?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_tasks?: number;
          created_at?: string;
          execution_score?: number;
          id?: string;
          successful_day?: boolean;
          summary_date?: string;
          total_tasks?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_summaries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      task_reminders: {
        Row: {
          created_at: string;
          id: string;
          remind_at: string;
          reminder_type: "5_minutes_before" | "at_start" | "overdue";
          sent_at: string | null;
          status: "failed" | "pending" | "processing" | "sent" | "skipped";
          task_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          remind_at: string;
          reminder_type: "5_minutes_before" | "at_start" | "overdue";
          sent_at?: string | null;
          status?: "failed" | "pending" | "processing" | "sent" | "skipped";
          task_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          remind_at?: string;
          reminder_type?: "5_minutes_before" | "at_start" | "overdue";
          sent_at?: string | null;
          status?: "failed" | "pending" | "processing" | "sent" | "skipped";
          task_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_reminders_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_reminders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_notifications: {
        Row: {
          accepted_task_id: string | null;
          actor_user_id: string;
          created_at: string;
          end_time: string;
          id: string;
          meeting_link: string | null;
          notification_type: "task_mention";
          read_at: string | null;
          start_time: string;
          status: "accepted" | "dismissed" | "expired" | "pending";
          task_date: string;
          task_id: string;
          task_title: string;
          task_type: "blocked" | "generic" | "meeting";
          updated_at: string;
          user_id: string;
        };
        Insert: {
          accepted_task_id?: string | null;
          actor_user_id: string;
          created_at?: string;
          end_time: string;
          id?: string;
          meeting_link?: string | null;
          notification_type?: "task_mention";
          read_at?: string | null;
          start_time: string;
          status?: "accepted" | "dismissed" | "expired" | "pending";
          task_date: string;
          task_id: string;
          task_title: string;
          task_type: "blocked" | "generic" | "meeting";
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accepted_task_id?: string | null;
          actor_user_id?: string;
          created_at?: string;
          end_time?: string;
          id?: string;
          meeting_link?: string | null;
          notification_type?: "task_mention";
          read_at?: string | null;
          start_time?: string;
          status?: "accepted" | "dismissed" | "expired" | "pending";
          task_date?: string;
          task_id?: string;
          task_title?: string;
          task_type?: "blocked" | "generic" | "meeting";
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_notifications_accepted_task_id_fkey";
            columns: ["accepted_task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_notifications_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          created_at: string;
          end_time: string;
          id: string;
          meeting_link: string | null;
          source_task_id: string | null;
          start_time: string;
          status: "pending" | "completed";
          task_date: string;
          task_type: "blocked" | "generic" | "meeting";
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          end_time: string;
          id?: string;
          meeting_link?: string | null;
          source_task_id?: string | null;
          start_time: string;
          status?: "pending" | "completed";
          task_date: string;
          task_type?: "blocked" | "generic" | "meeting";
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          end_time?: string;
          id?: string;
          meeting_link?: string | null;
          source_task_id?: string | null;
          start_time?: string;
          status?: "pending" | "completed";
          task_date?: string;
          task_type?: "blocked" | "generic" | "meeting";
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_participants: {
        Row: {
          created_at: string;
          id: string;
          participant_id: string;
          task_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          participant_id: string;
          task_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          participant_id?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_participants_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_participants_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      user_notification_preferences: {
        Row: {
          created_at: string;
          push_enabled: boolean;
          remind_5_min_before: boolean;
          remind_at_start: boolean;
          remind_overdue: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          push_enabled?: boolean;
          remind_5_min_before?: boolean;
          remind_at_start?: boolean;
          remind_overdue?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          push_enabled?: boolean;
          remind_5_min_before?: boolean;
          remind_at_start?: boolean;
          remind_overdue?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_account_usage_snapshot: {
        Args: {
          p_user_ids: string[];
        };
        Returns: {
          estimated_owned_records: number;
          user_id: string;
        }[];
      };
      accept_task_notification: {
        Args: {
          p_notification_id: string;
        };
        Returns: {
          accepted_task_id: string | null;
          outcome: string;
          task_date: string;
        }[];
      };
      mark_task_notifications_read: {
        Args: {
          p_notification_ids: string[];
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
