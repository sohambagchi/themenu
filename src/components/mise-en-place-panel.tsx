"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StyledSelect } from "@/components/styled-select";
import { insertItems, uploadInventoryImage } from "@/lib/inventoryApi";
import { formatQuantityValue, parseQuantityInput, QUANTITY_UNIT_OPTIONS } from "@/lib/quantity";
import type { ItemLocation, ItemType, NewItemInput, QuantityUnit, TagValue } from "@/lib/types";

const DEFAULT_TYPES: ItemType[] = ["Protein", "Carb", "Veg", "Ferment/Pickle"];
const CUSTOM_TYPES_STORAGE_KEY = "themenu_custom_prepared_types";

export function MiseEnPlacePanel() {
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>("");
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
  const parsedQuantity = useMemo(() => parseQuantityInput(quantityInput), [quantityInput]);

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
      quantity
    }: {
      username?: string;
      password?: string;
      quantity: number;
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
        quantity,
        quantityUnit,
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
      setQuantityUnit("");
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
          const quantity = parseQuantityInput(quantityInput);
          if (quantity === null || quantity <= 0) {
            setNotice("Quantity must be greater than zero. Fractions like 1/2 are allowed.");
            return;
          }
          if (sessionQuery.data?.authed) {
            createMutation.mutate({ quantity });
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
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Quantity</span>
          <div className="mt-2 flex overflow-hidden rounded border border-edge bg-canvas">
            <input
              type="text"
              inputMode="decimal"
              value={quantityInput}
              onChange={(event) => {
                setQuantityInput(event.target.value);
              }}
              className="w-full bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text"
              placeholder="e.g. 1, 0.5, 1/2"
            />
            <div className="min-w-[100px] border-l border-edge">
              <StyledSelect
                value={quantityUnit}
                onChange={(nextValue) => setQuantityUnit(nextValue as QuantityUnit)}
                options={QUANTITY_UNIT_OPTIONS}
                buttonClassName="h-full rounded-none border-0 bg-canvas px-2 py-2 text-xs"
                ariaLabel="Quantity unit"
              />
            </div>
          </div>
          {parsedQuantity !== null && parsedQuantity > 0 && (
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              Parsed: {formatQuantityValue(parsedQuantity)} {quantityUnit || "(blank)"}
            </p>
          )}
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
                  const quantity = parseQuantityInput(quantityInput);
                  if (quantity === null || quantity <= 0) {
                    setNotice("Quantity must be greater than zero. Fractions like 1/2 are allowed.");
                    return;
                  }
                  createMutation.mutate({
                    username: authUsername,
                    password: authPassword,
                    quantity
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
