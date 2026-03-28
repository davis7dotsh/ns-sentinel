CREATE TABLE "generated_app_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"status" varchar(32) NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(160) NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generated_apps_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "generated_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_version_id" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"slug" varchar(160),
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_version_id" uuid NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_app_versions" ADD CONSTRAINT "generated_app_versions_app_id_generated_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."generated_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_app_version_id_generated_app_versions_id_fk" FOREIGN KEY ("app_version_id") REFERENCES "public"."generated_app_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_events" ADD CONSTRAINT "generated_events_app_version_id_generated_app_versions_id_fk" FOREIGN KEY ("app_version_id") REFERENCES "public"."generated_app_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generated_app_versions_app_id_idx" ON "generated_app_versions" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "generated_app_versions_status_idx" ON "generated_app_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generated_apps_slug_idx" ON "generated_apps" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "generated_artifacts_app_version_id_idx" ON "generated_artifacts" USING btree ("app_version_id");--> statement-breakpoint
CREATE INDEX "generated_artifacts_kind_slug_idx" ON "generated_artifacts" USING btree ("kind","slug");--> statement-breakpoint
CREATE INDEX "generated_events_app_version_id_idx" ON "generated_events" USING btree ("app_version_id");--> statement-breakpoint
CREATE INDEX "generated_events_created_at_idx" ON "generated_events" USING btree ("created_at");