import { ConvexError } from "convex/values";
import { zid } from "convex-helpers/server/zod4";
import { zodMutation, zodQuery } from "./functions";
import { taskTagSchema } from "./schema";

export const createOne = zodMutation({
	args: taskTagSchema,
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("taskTags")
			.withIndex("by_task_tag", (q) =>
				q.eq("taskId", args.taskId).eq("tagId", args.tagId),
			)
			.unique();
		if (existing) throw new ConvexError("Duplicate task tag pair");

		return await ctx.db.insert("taskTags", args);
	},
});

export const readMany = zodQuery({
	args: {},
	handler: async (ctx, args) => {
		return await ctx.db.query("taskTags").collect();
	},
});

export const deleteOne = zodMutation({
	args: { id: zid("taskTags") },
	handler: async (ctx, args) => {
		return await ctx.db.delete("taskTags", args.id);
	},
});
