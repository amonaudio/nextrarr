/**
 * CustomFilterModal — create/edit/delete custom filters.
 * Backed by /api/filters (CRUD).
 */

'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { CustomFilter, CustomFilterRule } from '@/lib/types';

interface CustomFilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filter: CustomFilter) => void;
  onChanged: () => void;
}

export function CustomFilterModal({ open, onOpenChange, onApply, onChanged }: CustomFilterModalProps) {
  const [saved, setSaved] = useState<CustomFilter[]>([]);
  const [name, setName] = useState('');
  const [rules, setRules] = useState<CustomFilterRule[]>([{ type: 'has_theme', val: 'false' }]);
  const [editingId, setEditingId] = useState<string | null>(null);
  // [0.7.1] Confirmation dialog state (replaces window.confirm() which is
  // blocking and renders below Radix modals on some browsers).
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function loadSaved() {
    try {
      const res = await fetch('/api/filters');
      const list = await res.json();
      setSaved(list);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      loadSaved();
      setEditingId(null);
      setName('');
      setRules([{ type: 'has_theme', val: 'false' }]);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open]);

  function addRule() {
    setRules((r) => [...r, { type: 'has_theme', val: 'false' }]);
  }
  function removeRule(i: number) {
    setRules((r) => r.filter((_, j) => j !== i));
  }
  function patchRule(i: number, patch: Partial<CustomFilterRule>) {
    setRules((r) => r.map((rule, j) => (j === i ? { ...rule, ...patch } : rule)));
  }

  async function save() {
    if (!name.trim()) { toast.error('Inserisci un nome'); return; }
    if (rules.length === 0) { toast.error('Aggiungi almeno una regola'); return; }
    try {
      const url = '/api/filters' + (editingId ? `/${editingId}` : '');
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, rules }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        toast.success(editingId ? 'Filtro aggiornato!' : 'Nuovo filtro salvato!');
        await loadSaved();
        onChanged();
        // Apply the new/edited filter
        const f: CustomFilter = { id: json.id, name: json.name, rules: json.rules };
        onApply(f);
        onOpenChange(false);
      } else {
        toast.error(json.message ?? 'Errore');
      }
    } catch {
      toast.error('Errore di rete');
    }
  }

  function edit(f: CustomFilter) {
    setEditingId(f.id ?? null);
    setName(f.name);
    setRules(f.rules);
  }

  function requestRemove(id: string) {
    // [0.7.1] Open the confirmation dialog instead of calling window.confirm().
    setPendingDelete(id);
  }

  async function confirmRemove() {
    const id = pendingDelete;
    if (!id) return;
    setPendingDelete(null);
    try {
      await fetch(`/api/filters/${id}`, { method: 'DELETE' });
      toast.success('Filtro eliminato');
      await loadSaved();
      onChanged();
    } catch {
      toast.error('Errore di rete');
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* [0.7.1] Removed the unconditional preventDefault on outside click:
          this modal has no children overlays, so click-outside-to-close is
          the expected UX. Was previously always blocking, forcing the user
          to click "Annulla" every time. */}
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filtri Personalizzati</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold border-b border-border pb-1 mb-2">Filtri Salvati</h3>
            {saved.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nessun filtro salvato.</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {saved.map((f) => (
                  <div key={f.id} className="flex justify-between items-center bg-card p-2 rounded text-sm">
                    <span className="truncate">{f.name}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { onApply(f); onOpenChange(false); }}><Check className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => edit(f)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => f.id && requestRemove(f.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">{editingId ? 'Modifica Filtro' : 'Crea Nuovo Filtro'}</h3>
            <Input placeholder="Nome filtro (es. Da Completare)" value={name} onChange={(e) => setName(e.target.value)} className="mb-3" />
            <div className="space-y-2">
              {rules.map((r, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={r.type} onValueChange={(v) => patchRule(i, { type: v as CustomFilterRule['type'] })}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="has_theme">Tema</SelectItem>
                      <SelectItem value="has_artwork">Artwork</SelectItem>
                      <SelectItem value="has_trailer">Trailer</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm">è</span>
                  <Select value={r.val} onValueChange={(v) => patchRule(i, { val: v as 'true' | 'false' })}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Presente</SelectItem>
                      <SelectItem value="false">Mancante</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="destructive" onClick={() => removeRule(i)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" className="mt-2" onClick={addRule}>
              <Plus className="h-3 w-3 mr-1" /> Aggiungi Regola
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={save}>{editingId ? 'Aggiorna' : 'Salva'} Filtro</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* [0.7.1] Confirmation dialog for filter deletion. AlertDialog stacks
        above the parent Dialog (both z-50 Radix, but AlertDialog is mounted
        later → paints on top). ESC closes the AlertDialog first (Radix handles
        this correctly because both are Radix). */}
    <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminare questo filtro?</AlertDialogTitle>
          <AlertDialogDescription>
            L&apos;azione non è reversibile. Il filtro verrà rimosso dal database e non sarà più disponibile sui dispositivi collegati.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Elimina
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
