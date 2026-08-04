import { ConvexError } from "convex/values";
import { zid } from "convex-helpers/server/zod4";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { zodMutation, zodQuery } from "./functions";
import { taskDependencySchema } from "./schema";

async function validateTaskDependency(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	dependsOnId: Id<"tasks">,
) {
	if (taskId === dependsOnId) throw new ConvexError("Cannot depend on self");

	const existing = await ctx.db
		.query("taskDependencies")
		.withIndex("by_task_dependency", (q) =>
			q.eq("taskId", taskId).eq("dependsOnId", dependsOnId),
		)
		.unique();
	if (existing) throw new ConvexError("Duplicate dependency pair");

	const currentDeps = await ctx.db
		.query("taskDependencies")
		.withIndex("by_task_dependency", (q) => q.eq("taskId", taskId))
		.collect();
	if (currentDeps.length >= 10)
		throw new ConvexError("Max 10 dependencies per task");

	// Safe here because of the hard cap at 10 deps.
	const queue = [dependsOnId];
	const visited = new Set<string>();

	while (queue.length > 0) {
		const current = queue.shift()!;
		if (current === taskId) throw new ConvexError("Dependency cycle detected");
		if (visited.has(current)) continue;

		visited.add(current);
		const downstream = await ctx.db
			.query("taskDependencies")
			.withIndex("by_task_dependency", (q) => q.eq("taskId", current))
			.collect();

		for (const dep of downstream) queue.push(dep.dependsOnId);
	}
}

export const createOne = zodMutation({
	args: taskDependencySchema,
	handler: async (ctx, args) => {
		await validateTaskDependency(
			ctx,
			args.taskId as Id<"tasks">,
			args.dependsOnId as Id<"tasks">,
		);

		return await ctx.db.insert("taskDependencies", args);
	},
});

export const readMany = zodQuery({
	args: {},
	handler: async (ctx, args) => {
		return await ctx.db.query("taskDependencies").collect();
	},
});

export const deleteOne = zodMutation({
	args: { id: zid("taskDependencies") },
	handler: async (ctx, args) => {
		return await ctx.db.delete("taskDependencies", args.id);
	},
});
