CREATE TABLE "case_decision_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_decision_id" text NOT NULL,
	"external_ticket_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_decision_records_external_decision_id_unique" UNIQUE("external_decision_id")
);
--> statement-breakpoint
CREATE TABLE "case_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_ticket_id" text NOT NULL,
	"raw_input" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"missing_fields" jsonb NOT NULL,
	"extracted_draft" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_intakes_external_ticket_id_unique" UNIQUE("external_ticket_id")
);
--> statement-breakpoint
CREATE TABLE "case_operational_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intake_id" uuid NOT NULL,
	"external_ticket_id" text NOT NULL,
	"ticket_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_operational_facts_intake_id_unique" UNIQUE("intake_id"),
	CONSTRAINT "case_operational_facts_external_ticket_id_unique" UNIQUE("external_ticket_id")
);
--> statement-breakpoint
ALTER TABLE "case_operational_facts" ADD CONSTRAINT "case_operational_facts_intake_id_case_intakes_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."case_intakes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_decisions_ticket_idx" ON "case_decision_records" USING btree ("external_ticket_id");--> statement-breakpoint
CREATE INDEX "case_intakes_created_idx" ON "case_intakes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "case_facts_ticket_idx" ON "case_operational_facts" USING btree ("external_ticket_id");