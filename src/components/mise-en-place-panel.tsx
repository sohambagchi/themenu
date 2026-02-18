"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { insertItems } from "@/lib/inventoryApi";
import type { ItemLocation, ItemType, NewItemInput, TagValue } from "@/lib/types";

export function MiseEnPlacePanel() {
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [dateAdded, setDateAdded] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState<ItemLocation>("Fridge");
  const [type, setType] = useState<ItemType>("Protein");
  const [tagsText, setTagsText] = useState("");
  const [notice, setNotice] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const tags = tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean) as TagValue[];

      const payload: NewItemInput = {
        name: name.trim(),
        photoUrl: photoUrl.trim() || null,
        quantity: Math.max(1, Math.trunc(quantity)),
        dateAdded,
        stockKind: "Prepared",
        location,
        type,
        tags
      };

      await insertItems([payload]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "Prepared"] });
      setNotice("Prepared item added to stock.");
      setName("");
      setPhotoUrl("");
      setQuantity(1);
      setTagsText("");
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Failed to add prepared item.");
    }
  });

  return (
    <section className="rounded-lg border border-edge bg-card p-5">
      <h2 className="font-serif text-2xl">Mise en Place</h2>
      <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-muted">
        Add finished dishes to Prepared stock.
      </p>

      <form
        className="mt-5 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setNotice("");
          createMutation.mutate();
        }}
      >
        <label className="block">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="mt-2 w-full rounded border border-edge bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text"
          />
        </label>

        <label className="block">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Photo URL</span>
          <input
            value={photoUrl}
            onChange={(event) => setPhotoUrl(event.target.value)}
            className="mt-2 w-full rounded border border-edge bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text"
          />
        </label>

        <label className="block">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Servings</span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value) || 1)}
            className="mt-2 w-full rounded border border-edge bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text"
          />
        </label>

        <label className="block">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Date Added</span>
          <input
            type="date"
            value={dateAdded}
            onChange={(event) => setDateAdded(event.target.value)}
            className="mt-2 w-full rounded border border-edge bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text"
          />
        </label>

        <label className="block">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Location</span>
          <select
            value={location}
            onChange={(event) => setLocation(event.target.value as ItemLocation)}
            className="mt-2 w-full rounded border border-edge bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text"
          >
            <option>Fridge</option>
            <option>Freezer</option>
            <option>Pantry</option>
          </select>
        </label>

        <label className="block">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Type</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as ItemType)}
            className="mt-2 w-full rounded border border-edge bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text"
          >
            <option>Protein</option>
            <option>Carb</option>
            <option>Veg</option>
            <option>Ferment/Pickle</option>
          </select>
        </label>

        <label className="block md:col-span-2">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Tags (comma separated)</span>
          <input
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
            className="mt-2 w-full rounded border border-edge bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text"
            placeholder="Dry, Indian, Spicy"
          />
        </label>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded border border-text bg-text px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Prepared Item
          </button>
        </div>
      </form>

      {notice && <p className="mt-4 font-mono text-xs text-muted">{notice}</p>}
    </section>
  );
}
