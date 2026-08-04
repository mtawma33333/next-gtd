import { ConvexError } from "convex/values";
import { zid } from "convex-helpers/server/zod4";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { zodMutation, zodQuery } from "./functions";
import { listSchema } from "./schema";

async function validateListTree(
	ctx: MutationCtx,
	parentId: Id<"lists"> | undefined,
	currentId?: Id<"lists">,
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
	args: listSchema,
	handler: async (ctx, args) => {
		await validateListTree(ctx, args.parentId as Id<"lists">);
		return await ctx.db.insert("lists", args);
	},
});
export const readMany = zodQuery({
	args: {},
	handler: async (ctx, args) => {
		return await ctx.db.query("lists").collect();
	},
});

export const updateOne = zodMutation({
	args: {
		id: zid("lists"),
		mod: listSchema.partial(),
	},
	handler: async (ctx, args) => {
		if (args.mod.parentId !== undefined) {
			await validateListTree(
				ctx,
				args.mod.parentId as Id<"lists">,
				args.id as Id<"lists">,
			);
		}

		await ctx.db.patch("lists", args.id, args.mod);
		return null;
	},
});
export const deleteOne = zodMutation({
	args: { id: zid("lists") },
	handler: async (ctx, args) => {
		return await ctx.db.delete("lists", args.id);
	},
});
