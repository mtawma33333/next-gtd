import { ConvexError } from "convex/values";
import { zid } from "convex-helpers/server/zod4";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { zodMutation, zodQuery } from "./functions";
import { tagSchema } from "./schema";

async function validateTagTree(
	ctx: MutationCtx,
	parentId: Id<"tags"> | undefined,
	currentId?: Id<"tags">,
) {
	let curr = parentId;
	let ancestorCount = 0;

	while (curr) {
		ancestorCount++;
		if (ancestorCount >= 5)
			throw new ConvexError("Max depth of 5 levels exceeded");
		if (curr === currentId) throw new ConvexError("Cycle detected");

		const node = await ctx.db.get(curr);
		curr = node?.parentId;
	}
}

export const createOne = zodMutation({
	args: tagSchema,
	handler: async (ctx, args) => {
		await validateTagTree(ctx, args.parentId as Id<"tags">);
		return await ctx.db.insert("tags", args);
	},
});

export const readMany = zodQuery({
	args: {},
	handler: async (ctx, args) => {
		return await ctx.db.query("tags").collect();
	},
});

export const updateOne = zodMutation({
	args: {
		id: zid("tags"),
		mod: tagSchema.partial(),
	},
	handler: async (ctx, args) => {
		if (args.mod.parentId !== undefined) {
			await validateTagTree(
				ctx,
				args.mod.parentId as Id<"tags">,
				args.id as Id<"tags">,
			);
		}
		return await ctx.db.patch("tags", args.id, args.mod);
	},
});

export const deleteOne = zodMutation({
	args: { id: zid("tags") },
	handler: async (ctx, args) => {
		return await ctx.db.delete("tags", args.id);
	},
});
