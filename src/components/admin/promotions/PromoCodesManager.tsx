"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Edit, Loader2, MoreHorizontal, Plus, Tag, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/date-utils";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/inline-error";
import { TableSkeleton } from "@/components/ui/skeletons";

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "flat";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  min_purchase: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface PromoFormData {
  code: string;
  description: string;
  discount_type: "percentage" | "flat";
  discount_value: string;
  max_uses: string;
  min_purchase: string;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
}

const EMPTY_FORM: PromoFormData = {
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: "",
  max_uses: "",
  min_purchase: "0",
  starts_at: "",
  expires_at: "",
  is_active: true,
};

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "HAC-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function PromoCodesManager() {
  const supabase = createClient();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("Create Promo Code");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromoFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      setCodes(data ?? []);
    } catch {
      setError("Failed to load promo codes.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, code: generateCode() });
    setDialogTitle("Create Promo Code");
    setDialogOpen(true);
  };

  const openEdit = (c: PromoCode) => {
    setEditingId(c.id);
    setDialogTitle("Edit Promo Code");
    setForm({
      code: c.code,
      description: c.description ?? "",
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      max_uses: c.max_uses ? String(c.max_uses) : "",
      min_purchase: String(c.min_purchase ?? 0),
      starts_at: c.starts_at ? c.starts_at.slice(0, 16) : "",
      expires_at: c.expires_at ? c.expires_at.slice(0, 16) : "",
      is_active: c.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.discount_value) {
      toast.error("Code and discount value are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        min_purchase: Number(form.min_purchase) || 0,
        starts_at: form.starts_at || null,
        expires_at: form.expires_at || null,
        is_active: form.is_active,
      };

      if (editingId) {
        const { error } = await supabase.from("promo_codes").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Promo code updated.");
      } else {
        const { error } = await supabase.from("promo_codes").insert(payload);
        if (error) throw error;
        toast.success("Promo code created.");
      }
      setDialogOpen(false);
      await fetchCodes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase.from("promo_codes").update({ is_active: !isActive }).eq("id", id);
    if (error) {
      toast.error("Failed to update.");
      return;
    }
    toast.success(isActive ? "Code deactivated." : "Code activated.");
    await fetchCodes();
  };

  const deleteCode = async (id: string) => {
    if (!confirm("Delete this promo code permanently?")) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete.");
      return;
    }
    toast.success("Promo code deleted.");
    await fetchCodes();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied!");
  };

  const set = (key: keyof PromoFormData, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Promo Codes</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage discount codes for checkout.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Create Code
        </Button>
      </div>

      {error ? (
        <InlineError message={error} onRetry={fetchCodes} />
      ) : loading ? (
        <TableSkeleton rows={3} cols={7} />
      ) : codes.length === 0 ? (
        <EmptyState
          icon={<Tag className="size-10" />}
          title="No promo codes yet"
          description="Create your first promo code to offer discounts at checkout."
          action={{ label: "Create Code", onClick: openCreate }}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead className="hidden lg:table-cell">Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((c) => {
                const expired = c.expires_at && new Date(c.expires_at) < new Date();
                const maxedOut = c.max_uses && c.current_uses >= c.max_uses;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium tracking-wider">{c.code}</span>
                        <button onClick={() => copyCode(c.code)} className="text-muted-foreground hover:text-foreground">
                          <Copy className="size-3" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {c.discount_type === "percentage" ? `${c.discount_value}%` : `$${c.discount_value}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {c.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.current_uses}{c.max_uses ? `/${c.max_uses}` : ""}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {c.expires_at ? formatDateShort(c.expires_at) : "Never"}
                    </TableCell>
                    <TableCell>
                      {!c.is_active ? (
                        <Badge variant="secondary">Inactive</Badge>
                      ) : expired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : maxedOut ? (
                        <Badge variant="secondary">Maxed Out</Badge>
                      ) : (
                        <Badge className="bg-green-500 text-white">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label="Actions">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Edit className="mr-2 size-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleActive(c.id, c.is_active)}>
                            {c.is_active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteCode(c.id)} className="text-destructive">
                            <Trash2 className="mr-2 size-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>Configure the promo code details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <div className="flex gap-2">
                <Input
                  value={form.code}
                  onChange={(e) => set("code", e.target.value.toUpperCase())}
                  className="font-mono tracking-wider"
                  placeholder="HACSWIM0"
                />
                <Button variant="outline" size="sm" onClick={() => set("code", generateCode())}>
                  Generate
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Summer launch special"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={form.discount_type} onValueChange={(v) => set("discount_type", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="flat">Flat Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  type="number"
                  min={0}
                  max={form.discount_type === "percentage" ? 100 : undefined}
                  value={form.discount_value}
                  onChange={(e) => set("discount_value", e.target.value)}
                  placeholder={form.discount_type === "percentage" ? "10" : "25.00"}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Uses</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.max_uses}
                  onChange={(e) => set("max_uses", e.target.value)}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label>Min Purchase ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.min_purchase}
                  onChange={(e) => set("min_purchase", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Starts At</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => set("starts_at", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Expires At</Label>
                <Input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => set("expires_at", e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.is_active}
                onCheckedChange={(v) => set("is_active", v === true)}
              />
              <Label>Active</Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
