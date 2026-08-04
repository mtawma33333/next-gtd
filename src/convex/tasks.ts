import { ConvexError } from "convex/values";
import { zid } from "convex-helpers/server/zod4";
import { zodMutation, zodQuery } from "./functions";
import { taskSchema, taskSchemaRefined } from "./schema";

const enforceStateTime = <T extends { status?: string; doneAt?: number }>(
	data: T,
) => {
	if (data.status === "todo" || data.status === "cancel") {
		data.doneAt = undefined;
	} else if (data.status === "done" && !data.doneAt) {
		data.doneAt = Date.now();
	}
};

export const createOne = zodMutation({
	args: taskSchemaRefined,
	handler: async (ctx, args) => {
		enforceStateTime(args);
		return await ctx.db.insert("tasks", args);
	},
});

export const readMany = zodQuery({
	args: {},
	handler: async (ctx, args) => {
		return await ctx.db.query("tasks").collect();
	},
});

export const updateOne = zodMutation({
	args: {
		id: zid("tasks"),
		mod: taskSchema.partial(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db.get("tasks", args.id);
		if (!existing) throw new ConvexError("task not found");

		const merged = { ...existing, ...args.mod };
		enforceStateTime(merged);
		taskSchemaRefined.parse(merged);

		return await ctx.db.patch("tasks", args.id, merged);
	},
});
export const deleteOne = zodMutation({
	args: { id: zid("tasks") },
	handler: async (ctx, args) => {
		return await ctx.db.delete("tasks", args.id);
	},
});
