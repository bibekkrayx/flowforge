import { PAGINATION } from "@/config/constants";
import { prisma } from "@/lib/prisma";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  premiumProcedure,
  protectedProcedure,
} from "@/trpc/init";
import { generateSlug } from "random-word-slugs";
import z from "zod";
import type { Node, Edge } from "@xyflow/react";
import { NodeType } from "@/generated/prisma/enums";
import { claimGoogleFormId } from "@/lib/resolve-google-form-workflow";
import {
  computeNextRun,
  isValidCron,
  isValidTimezone,
} from "@/lib/schedule/cron";
import {
  ReminderDirection,
  ReminderUnit,
  TriggerKind,
} from "@/generated/prisma/enums";
import { computeFireAt } from "@/lib/reminders/offset";
import {
  sendWorkflowExecution,
  TriggerDisabledError,
} from "@/inngest/utils";

export const workflowsRouter = createTRPCRouter({

  execute: protectedProcedure
    .input(z.object({id: z.string()}))
    .mutation(async ({input, ctx}) => {
      const workflow = await prisma.workflow.findUniqueOrThrow({
        where: {
          id: input.id,
          userId: ctx.auth.user.id
        }
      })
      try {
        await sendWorkflowExecution(
          { workflowId: input.id },
          { triggerKind: TriggerKind.MANUAL },
        );
      } catch (error) {
        if (error instanceof TriggerDisabledError) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Manual triggers are disabled platform-wide",
          });
        }
        throw error;
      }

      return workflow;
    }),

  create: premiumProcedure.mutation(({ ctx }) => {
    return prisma.workflow.create({
      data: {
        name: generateSlug(3),
        userId: ctx.auth.user.id,
        nodes: {
          create: {
            type: NodeType.INITIAL,
            position: { x: 0, y: 0 },
            name: NodeType.INITIAL,
          },
        },
      },
    });
  }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return prisma.workflow.delete({
        where: {
          id: input.id,
          userId: ctx.auth.user.id,
        },
      });
    }),

  updateName: protectedProcedure
    .input(z.object({ newName: z.string().min(1), id: z.string() }))
    .mutation(({ ctx, input }) => {
      return prisma.workflow.update({
        where: {
          userId: ctx.auth.user.id,
          id: input.id,
        },
        data: {
          name: input.newName,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        nodes: z.array(
          z.object({
            id: z.string(),
            type: z.string().nullish(),
            position: z.object({
              x: z.number(),
              y: z.number(),
            }),
            data: z.record(z.string(), z.any()).optional(),
          }),
        ),
        edges: z.array(
          z.object({
            source: z.string(),
            target: z.string(),
            sourceHandle: z.string().nullish(),
            targetHandle: z.string().nullish(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, nodes, edges } = input;
      const workflow = await prisma.workflow.findFirstOrThrow({
        where: { id, userId: ctx.auth.user.id },
      });

      return await prisma.$transaction(async (tx) => {
        await tx.connection.deleteMany({
          where: { workflowId: id },
        });

        await tx.node.deleteMany({
          where: { workflowId: id },
        });

        await tx.node.createMany({
          data: nodes.map((node) => ({
            id: node.id,
            workflowId: id,
            name: node.type || "unknown",
            type: node.type as NodeType,
            position: node.position,
            data: node.data || {},
          })),
        });

        const uniqueEdges = new Map<
          string,
          (typeof edges)[number]
        >();

        for (const edge of edges) {
          const fromOutput = edge.sourceHandle || "main";
          const toInput = edge.targetHandle || "main";
          const key = `${edge.source}|${edge.target}|${fromOutput}|${toInput}`;
          uniqueEdges.set(key, edge);
        }

        if (uniqueEdges.size > 0) {
          await tx.connection.createMany({
            data: [...uniqueEdges.values()].map((edge) => ({
              workflowId: id,
              fromNodeId: edge.source,
              toNodeId: edge.target,
              fromOutput: edge.sourceHandle || "main",
              toInput: edge.targetHandle || "main",
            })),
          });
        }

        // update workflow update timestamp
        await tx.workflow.update({
          where: { id },
          data: { updatedAt: new Date() },
        });
        return workflow;
      });
    }),

  updateGoogleFormTrigger: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        nodeId: z.string(),
        formId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const node = await prisma.node.findFirst({
        where: {
          id: input.nodeId,
          workflowId: input.workflowId,
          type: NodeType.GOOGLE_FORM_TRIGGER,
          workflow: { userId: ctx.auth.user.id },
        },
      });

      if (!node) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Save the workflow before configuring the trigger.",
        });
      }

      const data = (node.data as Record<string, unknown>) || {};

      return claimGoogleFormId(
        ctx.auth.user.id,
        node.id,
        input.formId,
        data,
      );
    }),

  updateScheduleTrigger: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        nodeId: z.string(),
        mode: z.enum(["SIMPLE", "ADVANCED"]),
        cronExpression: z.string().min(1),
        timezone: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isValidCron(input.cronExpression)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid cron expression",
        });
      }

      if (!isValidTimezone(input.timezone)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid timezone",
        });
      }

      const node = await prisma.node.findFirst({
        where: {
          id: input.nodeId,
          workflowId: input.workflowId,
          type: NodeType.SCHEDULE_TRIGGER,
          workflow: { userId: ctx.auth.user.id },
        },
      });

      if (!node) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Save the workflow before configuring the trigger.",
        });
      }

      const nextRunAt = computeNextRun(
        input.cronExpression,
        new Date(),
        input.timezone,
      );

      return prisma.scheduleTrigger.upsert({
        where: { nodeId: node.id },
        create: {
          workflowId: input.workflowId,
          nodeId: node.id,
          mode: input.mode,
          cronExpression: input.cronExpression,
          timezone: input.timezone,
          nextRunAt,
        },
        update: {
          mode: input.mode,
          cronExpression: input.cronExpression,
          timezone: input.timezone,
          nextRunAt,
        },
      });
    }),

  getScheduleStatus: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const trigger = await prisma.scheduleTrigger.findFirst({
        where: {
          nodeId: input.nodeId,
          workflow: { userId: ctx.auth.user.id },
        },
      });

      if (!trigger) {
        return null;
      }

      return {
        cronExpression: trigger.cronExpression,
        timezone: trigger.timezone,
        mode: trigger.mode,
        enabled: trigger.enabled,
        lastRunAt: trigger.lastRunAt,
        nextRunAt: trigger.nextRunAt,
      };
    }),

  /**
   * Materialize an EVENT_TRIGGER node's config into an EventReminder row keyed
   * by nodeId. `fireAt` is derived from the linked event's start time and the
   * configured offset. Re-saving re-arms the reminder (clears `triggeredAt`).
   */
  updateEventTrigger: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        nodeId: z.string(),
        eventId: z.string().min(1),
        offsetValue: z.number().int().min(0),
        offsetUnit: z.enum(ReminderUnit),
        direction: z.enum(ReminderDirection),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const node = await prisma.node.findFirst({
        where: {
          id: input.nodeId,
          workflowId: input.workflowId,
          type: NodeType.EVENT_TRIGGER,
          workflow: { userId: ctx.auth.user.id },
        },
      });

      if (!node) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Save the workflow before configuring the reminder.",
        });
      }

      const event = await prisma.calendarEvent.findFirst({
        where: { id: input.eventId, userId: ctx.auth.user.id },
      });

      if (!event) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Selected calendar event not found.",
        });
      }

      const fireAt = computeFireAt(
        event.startAt,
        input.offsetValue,
        input.offsetUnit,
        input.direction,
      );

      return prisma.eventReminder.upsert({
        where: { nodeId: node.id },
        create: {
          workflowId: input.workflowId,
          nodeId: node.id,
          eventId: input.eventId,
          offsetValue: input.offsetValue,
          offsetUnit: input.offsetUnit,
          direction: input.direction,
          fireAt,
        },
        update: {
          eventId: input.eventId,
          offsetValue: input.offsetValue,
          offsetUnit: input.offsetUnit,
          direction: input.direction,
          fireAt,
          triggeredAt: null,
        },
      });
    }),

  getEventTriggerStatus: protectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const reminder = await prisma.eventReminder.findFirst({
        where: {
          nodeId: input.nodeId,
          workflow: { userId: ctx.auth.user.id },
        },
      });

      if (!reminder) {
        return null;
      }

      return {
        eventId: reminder.eventId,
        offsetValue: reminder.offsetValue,
        offsetUnit: reminder.offsetUnit,
        direction: reminder.direction,
        fireAt: reminder.fireAt,
        triggeredAt: reminder.triggeredAt,
        enabled: reminder.enabled,
      };
    }),

  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const workflow = await prisma.workflow.findFirstOrThrow({
        where: {
          id: input.id,
          userId: ctx.auth.user.id,
        },
        include: {
          nodes: true,
          connections: true,
        },
      });

      /**
       * Transform server node to react-flow nodes
       */
      const nodes: Node[] = workflow.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position as { x: number; y: number },
        data: (node.data as Record<string, unknown>) || {},
      }));

      /**
       *  transform server connection to react-flow edge
       *
       */

      const edges: Edge[] = workflow.connections.map((connection) => ({
        id: connection.id,
        source: connection.fromNodeId,
        target: connection.toNodeId,
        sourceHandle: connection.fromOutput,
        targetHandle: connection.toInput,
      }));

      return {
        id: workflow.id,
        name: workflow.name,
        nodes,
        edges,
      };
    }),

  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().default(PAGINATION.DEFAULT_PAGE),
        pageSize: z
          .number()
          .min(PAGINATION.MIN_PAGE_SIZE)
          .max(PAGINATION.MAX_PAGE_SIZE)
          .default(PAGINATION.DEFAULT_PAGE_SIZE),
        search: z.string().default(""),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search } = input;
      const [items, totalCount] = await Promise.all([
        prisma.workflow.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where: {
            userId: ctx.auth.user.id,
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
        }),
        prisma.workflow.count({
          where: {
            userId: ctx.auth.user.id,
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hadPreviousPage = page > 1;

      return {
        items,
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage,
        hadPreviousPage,
      };
    }),
});
