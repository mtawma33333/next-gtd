import {
	customCtx,
	customMutation,
	NoOp,
} from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";
import { zCustomMutation, zCustomQuery } from "convex-helpers/server/zod4";
import type { DataModel } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

const triggers = new Triggers<DataModel>();

// Lists recursively archive children
triggers.register("lists", async (ctx, change) => {
	if (
		change.newDoc?.archivedAt &&
		change.oldDoc?.archivedAt !== change.newDoc.archivedAt
	) {
		const children = await ctx.db
			.query("lists")
			.withIndex("by_parent", (q) => q.eq("parentId", change.id))
			.collect();
		for (const child of children) {
			if (!child.archivedAt)
				await ctx.db.patch(child._id, { archivedAt: change.newDoc.archivedAt });
		}
	}
});
// Deletions & Cascades: Lists
triggers.register("lists", async (ctx, change) => {
	if (change.operation === "delete") {
		const children = await ctx.db
			.query("lists")
			.withIndex("by_parent", (q) => q.eq("parentId", change.id))
			.collect();
		for (const child of children) await ctx.db.delete(child._id);
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_list", (q) => q.eq("listId", change.id))
			.collect();
		for (const task of tasks)
			await ctx.db.patch(task._id, { listId: undefined });
	}
});
// Deletions & Cascades: Tags
triggers.register("tags", async (ctx, change) => {
	if (change.operation === "delete") {
		const children = await ctx.db
			.query("tags")
			.withIndex("by_parent", (q) => q.eq("parentId", change.id))
			.collect();
		for (const child of children) await ctx.db.delete(child._id);
		const taskTags = await ctx.db
			.query("taskTags")
			.withIndex("by_tag", (q) => q.eq("tagId", change.id))
			.collect();
		for (const tt of taskTags) await ctx.db.delete(tt._id);
	}
});
// Deletions & Cascades: Tasks (Junction cleanup + Bridging)
triggers.register("tasks", async (ctx, change) => {
	if (change.operation === "delete") {
		const taskTags = await ctx.db
			.query("taskTags")
			.withIndex("by_task_tag", (q) => q.eq("taskId", change.id))
			.collect();
		for (const tt of taskTags) await ctx.db.delete(tt._id);
		const parents = await ctx.db
			.query("taskDependencies")
			.withIndex("by_dependsOn", (q) => q.eq("dependsOnId", change.id))
			.collect();
		const children = await ctx.db
			.query("taskDependencies")
			.withIndex("by_task_dependency", (q) => q.eq("taskId", change.id))
			.collect();
		for (const p of parents) {
			const parentDeps = await ctx.db
				.query("taskDependencies")
				.withIndex("by_task_dependency", (q) => q.eq("taskId", p.taskId))
				.collect();

			// Bridge A -> C if within limit. Max deps is 10, so loop is tiny.
			if (parentDeps.length - 1 + children.length <= 10) {
				for (const c of children) {
					if (p.taskId !== c.dependsOnId) {
						await ctx.db.insert("taskDependencies", {
							taskId: p.taskId,
							dependsOnId: c.dependsOnId,
						});
					}
				}
			}
			await ctx.db.delete(p._id);
		}
		for (const c of children) await ctx.db.delete(c._id);
	}
});

const mutationWithTriggers = customMutation(
	mutation,
	customCtx(triggers.wrapDB),
);

export const zodQuery = zCustomQuery(query, NoOp);
export const zodMutation = zCustomMutation(mutationWithTriggers, NoOp);
