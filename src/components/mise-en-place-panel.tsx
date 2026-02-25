"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StyledSelect } from "@/components/styled-select";
import { insertItems, uploadInventoryImage } from "@/lib/inventoryApi";
import type { ItemLocation, ItemType, NewItemInput, TagValue } from "@/lib/types";

const DEFAULT_TYPES: ItemType[] = ["Protein", "Carb", "Veg", "Ferment/Pickle"];
const CUSTOM_TYPES_STORAGE_KEY = "themenu_custom_prepared_types";

const parseServingsInput = (rawValue: string): number | null => {
  const parsed = Number(rawValue);
  const whole = Math.trunc(parsed);
  if (!Number.isFinite(parsed) || whole < 1) return null;
  return whole;
};

export function MiseEnPlacePanel() {
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const [dateAdded, setDateAdded] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState<ItemLocation>("Fridge");
  const [type, setType] = useState<ItemType>("Protein");
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [customTypeInput, setCustomTypeInput] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [notice, setNotice] = useState("");
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const filePickerRef = useRef<HTMLInputElement>(null);
  const cameraPickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(CUSTOM_TYPES_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        setCustomTypes(parsed.filter((entry) => typeof entry === "string" && entry.trim().length > 0));
      }
    } catch {
      // Ignore invalid local storage value.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CUSTOM_TYPES_STORAGE_KEY, JSON.stringify(customTypes));
  }, [customTypes]);

  const allTypeOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_TYPES);
    for (const value of customTypes) set.add(value);
    return Array.from(set);
  }, [customTypes]);
  const parsedServings = useMemo(() => parseServingsInput(quantityInput), [quantityInput]);

  const sessionQuery = useQuery({
    queryKey: ["dashboard-session"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard-auth/session", { cache: "no-store" });
      if (!response.ok) return { authed: false };
      return (await response.json()) as { authed: boolean };
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => uploadInventoryImage(file),
    onSuccess: (url) => {
      setPhotoUrl(url);
      setNotice("Photo uploaded.");
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Failed to upload photo.");
    }
  });

  const onFilePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setNotice("");
    uploadMutation.mutate(file);
  };

  const createMutation = useMutation({
    mutationFn: async ({
      username,
      password,
      servings
    }: {
      username?: string;
      password?: string;
      servings: number;
    }) => {
      const tags = tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean) as TagValue[];

      const ingredients = ingredientsText
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      const payload: NewItemInput = {
        name: name.trim(),
        photoUrl: photoUrl.trim() || null,
        quantity: servings,
        dateAdded,
        inventoryLabel: "Menu",
        location,
        type,
        ingredients,
        tags
      };

      await insertItems([payload], username, password);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "Menu"] });
      setNotice("Menu item added to stock.");
      setName("");
      setPhotoUrl("");
      setQuantityInput("1");
      setIngredientsText("");
      setTagsText("");
      setAuthPromptOpen(false);
      setAuthUsername("");
      setAuthPassword("");
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Failed to add prepared item.");
    }
  });

  const addCustomType = () => {
    const normalized = customTypeInput.trim();
    if (!normalized) return;
    setCustomTypes((current) =>
      current.includes(normalized) || DEFAULT_TYPES.includes(normalized as ItemType)
        ? current
        : [...current, normalized]
    );
    setType(normalized as ItemType);
    setCustomTypeInput("");
  };

  const stepServings = (delta: number) => {
    const base = parsedServings ?? 1;
    setQuantityInput(String(Math.max(1, base + delta)));
  };

  return (
    <section className="rounded-lg border border-edge bg-card p-5">
      <h2 className="font-serif text-2xl">Mise en Place</h2>
      <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-muted">
        Add finished dishes to Menu stock.
      </p>

      <form
        className="mt-5 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setNotice("");
          const servings = parseServingsInput(quantityInput);
          if (servings === null) {
            setNotice("Servings must be a non-zero number.");
            return;
          }
          if (sessionQuery.data?.authed) {
            createMutation.mutate({ servings });
            return;
          }

          setAuthPromptOpen(true);
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
          <div className="mt-2 space-y-2">
            <input
              value={photoUrl}
              onChange={(event) => setPhotoUrl(event.target.value)}
              className="w-full rounded border border-edge bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text"
              placeholder="https://... or upload below"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => filePickerRef.current?.click()}
                disabled={uploadMutation.isPending}
                className="rounded border border-edge px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-muted transition hover:border-text hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                Upload Photo
              </button>
              <button
                type="button"
                onClick={() => cameraPickerRef.current?.click()}
                disabled={uploadMutation.isPending}
                className="rounded border border-edge px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-muted transition hover:border-text hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                Take Photo
              </button>
            </div>
            <input
              ref={filePickerRef}
              type="file"
              accept="image/*"
              onChange={onFilePicked}
              className="hidden"
            />
            <input
              ref={cameraPickerRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFilePicked}
              className="hidden"
            />
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Photo preview" className="h-24 w-24 rounded border border-edge object-cover" />
            )}
          </div>
        </label>

        <label className="block">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Servings</span>
          <div className="mt-2 flex overflow-hidden rounded border border-edge bg-canvas">
            <div className="flex w-10 flex-col border-r border-edge">
              <button
                type="button"
                onClick={() => stepServings(1)}
                className="flex-1 border-b border-edge text-sm text-muted transition hover:bg-card hover:text-text"
                aria-label="Increase servings"
              >
                ^
              </button>
              <button
                type="button"
                onClick={() => stepServings(-1)}
                disabled={(parsedServings ?? 1) <= 1}
                className="flex-1 text-sm text-muted transition hover:bg-card hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Decrease servings"
              >
                v
              </button>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={quantityInput}
              onChange={(event) => {
                const nextValue = event.target.value.trim();
                if (!nextValue) {
                  setQuantityInput("");
                  return;
                }
                if (!/^\d+$/.test(nextValue)) return;
                setQuantityInput(nextValue);
              }}
              className="w-full bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text"
            />
          </div>
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
          <StyledSelect
            value={location}
            onChange={(nextValue) => setLocation(nextValue as ItemLocation)}
            options={["Fridge", "Freezer", "Pantry"]}
            className="mt-2"
            buttonClassName="bg-canvas"
            ariaLabel="Location"
          />
        </label>

        <div className="block">
          <label className="block">
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Type</span>
            <StyledSelect
              value={type}
              onChange={(nextValue) => setType(nextValue as ItemType)}
              options={allTypeOptions}
              className="mt-2"
              buttonClassName="bg-canvas"
              ariaLabel="Type"
            />
          </label>
          {sessionQuery.data?.authed && (
            <div className="mt-2 flex gap-2">
              <input
                value={customTypeInput}
                onChange={(event) => setCustomTypeInput(event.target.value)}
                className="w-full rounded border border-edge bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text"
                placeholder="Add custom type"
              />
              <button
                type="button"
                onClick={addCustomType}
                className="rounded border border-edge px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-muted transition hover:border-text hover:text-text"
              >
                Add
              </button>
            </div>
          )}
        </div>

        <label className="block md:col-span-2">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
            Ingredients (comma separated)
          </span>
          <input
            value={ingredientsText}
            onChange={(event) => setIngredientsText(event.target.value)}
            className="mt-2 w-full rounded border border-edge bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text"
            placeholder="onion, garlic, butter"
          />
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
            disabled={createMutation.isPending || uploadMutation.isPending}
            className="rounded border border-text bg-text px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploadMutation.isPending ? "Uploading..." : "Add Menu Item"}
          </button>
        </div>

        {authPromptOpen && (
          <div className="md:col-span-2 grid gap-3 rounded border border-edge bg-canvas p-4 md:grid-cols-3">
            <label className="block">
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Username</span>
              <input
                value={authUsername}
                onChange={(event) => setAuthUsername(event.target.value)}
                className="mt-2 w-full rounded border border-edge bg-card px-3 py-2 text-sm outline-none transition focus:border-text"
              />
            </label>
            <label className="block">
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Password</span>
              <input
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                type="password"
                className="mt-2 w-full rounded border border-edge bg-card px-3 py-2 text-sm outline-none transition focus:border-text"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                disabled={createMutation.isPending || uploadMutation.isPending}
                onClick={() => {
                  setNotice("");
                  const servings = parseServingsInput(quantityInput);
                  if (servings === null) {
                    setNotice("Servings must be a non-zero number.");
                    return;
                  }
                  createMutation.mutate({
                    username: authUsername,
                    password: authPassword,
                    servings
                  });
                }}
                className="rounded border border-text bg-text px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-canvas disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm Add
              </button>
              <button
                type="button"
                onClick={() => setAuthPromptOpen(false)}
                className="rounded border border-edge px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-muted transition hover:border-text hover:text-text"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </form>

      {notice && <p className="mt-4 font-mono text-xs text-muted">{notice}</p>}
    </section>
  );
}
