import { defineSchema, defineTable } from "convex/server";
import { zid, zodToConvex } from "convex-helpers/server/zod4";
import { z } from "zod";

/**
 * WARNING: Convex database does NOT enforce Zod refinements (.min, .max) at rest.
 * zodToConvex() only extracts base types (v.string, v.number) for the table definitions.
 *
 * Limitations:
 * - Data modified via Convex Dashboard or CLI bypasses Zod rules entirely.
 * - The DB only guarantees a string is a string, not that its length is 1-100.
 *
 * Why do it? Single source of truth. It makes the schema self-documenting and
 * provides strict types for API arguments. Mutations MUST still explicitly run
 * these Zod schemas to validate data before insert/patch.
 */
export const statusSchema = z.enum(["todo", "done", "cancel"]);

export const tagSchema = z.object({
	name: z.string().min(1).max(100),
	parentId: zid("tags").optional(),
});

export const listSchema = z.object({
	name: z.string().min(1).max(100),
	note: z.string().max(30000),
	archivedAt: z.number().optional(),
	parentId: zid("lists").optional(),
});

export const taskSchema = z.object({
	name: z.string().min(1).max(100),
	note: z.string().max(30000),
	status: statusSchema,
	due: z.number().optional(),
	wait: z.number().optional(),
	doneAt: z.number().optional(),
	listId: zid("lists").optional(),
});

export const taskSchemaRefined = taskSchema.refine(
	(data) => {
		if (data.wait !== undefined && data.due !== undefined) {
			return data.wait <= data.due;
		}
		return true;
	},
	{ message: "wait must not be later than due" },
);

export const taskTagSchema = z.object({
	taskId: zid("tasks"),
	tagId: zid("tags"),
});

export const taskDependencySchema = z.object({
	taskId: zid("tasks"),
	dependsOnId: zid("tasks"),
});

export default defineSchema({
	tags: defineTable(zodToConvex(tagSchema)).index("by_parent", ["parentId"]),
	lists: defineTable(zodToConvex(listSchema)).index("by_parent", ["parentId"]),
	tasks: defineTable(zodToConvex(taskSchema))
		.index("by_due", ["due"])
		.index("by_doneAt", ["doneAt"])
		.index("by_list", ["listId"]),
	taskTags: defineTable(zodToConvex(taskTagSchema))
		.index("by_task_tag", ["taskId", "tagId"])
		.index("by_tag", ["tagId"]),
	taskDependencies: defineTable(zodToConvex(taskDependencySchema))
		.index("by_task_dependency", ["taskId", "dependsOnId"])
		.index("by_dependsOn", ["dependsOnId"]),
});
