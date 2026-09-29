import React, { useState, useEffect, useMemo } from 'react';
import {  useFMSData, formatDateTime } from '@/hooks/useFMSData';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Play, CheckCircle, Timer, Factory, ArrowLeft, Search, Loader2 } from 'lucide-react';
import { generateQRCodeImage } from '@/lib/qrCodeUtils';

export interface PickleRun {
  id: string;
  run_number: string;
  finished_good_id: string;
  planned_total_qty: number;
  unit_of_measure: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  notes?: string | null;
  created_by?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface PickleStage {
  id: string;
  run_id: string;
  stock_code_id: string;
  parent_stage_id?: string | null;
  stage_order: number;
  is_root: boolean;
  required_qty: number;
  unit_of_measure: string;
  status: 'NOT_STARTED' | 'READY' | 'IN_PROGRESS' | 'SOAKING' | 'READY_FOR_NEXT_STAGE' | 'COMPLETED' | 'CANCELLED';
  is_soaking: boolean;
  process_instructions?: string | null;
  soaking_start_at?: string | null;
  min_ready_date?: string | null;
  max_ready_date?: string | null;
  actual_ready_date?: string | null;
  elapsed_days?: number | null;
  container_id?: string | null;
  output_lot_id?: string | null;
  completed_quantity?: number | null;
  operator_id?: string | null;
  verified: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface PickleIngredient {
  id: string;
  stage_id: string;
  material_stock_code_id: string;
  source_type: 'receiving' | 'wip_stage';
  source_stage_id?: string | null;
  receiving_record_id?: string | null;
  internal_lot_number?: string | null;
  required_qty: number;
  measured_qty?: number | null;
  unit_of_measure: string;
  variance?: number | null;
  status: 'PENDING' | 'WEIGHED' | 'COMPLETED';
  operator_id?: string | null;
  measured_at?: string | null;
  created_at: string;
}

interface FMSOperator { id: string; user_id: string; name: string; role: string; is_active: boolean; }

const STAGE_LABEL: Record<PickleStage['status'], string> = {
  NOT_STARTED: 'Not started', READY: 'Ready', IN_PROGRESS: 'In progress',
  SOAKING: 'Soaking', READY_FOR_NEXT_STAGE: 'Ready for next stage',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};
const STAGE_BADGE: Record<PickleStage['status'], string> = {
  NOT_STARTED: 'badge-inactive', READY: 'badge-inactive', IN_PROGRESS: 'badge-active',
  SOAKING: 'badge-active', READY_FOR_NEXT_STAGE: 'badge-active',
  COMPLETED: 'badge-active', CANCELLED: 'badge-inactive',
};

const fmtNum = (n: number | null | undefined, digits = 2): string =>
  n == null || isNaN(Number(n)) ? '—' : Number(n).toFixed(digits).replace(/\.?0+$/, '');

const daysBetween = (a: string, b: string): number => {
  const da = new Date(a); da.setHours(0, 0, 0, 0);
  const db = new Date(b); db.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86400000) + 1);
};

const PickleProduction: React.FC = () => {
  const { user, fmsUser } = useFMSAuth();

  console.log('[Pickle] Auth user ID:', user?.id);
  console.log('[Pickle] FMS user:', fmsUser);

  const { stockCodes, boms, receivingRecords, refreshData } = useFMSData();


  const [runs, setRuns] = useState<PickleRun[]>([]);
  const [stages, setStages] = useState<PickleStage[]>([]);
  const [ingredients, setIngredients] = useState<PickleIngredient[]>([]);
  const [materialsUsed, setMaterialsUsed] = useState<{ receiving_record_id: string; quantity_used: number }[]>([]);
  const [operators, setOperators] = useState<FMSOperator[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [busyStageId, setBusyStageId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createFG, setCreateFG] = useState('');
  const [createQty, setCreateQty] = useState('1000');
  const [createNotes, setCreateNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [pendingSoak, setPendingSoak] = useState<PickleStage | null>(null);
  const [soakMin, setSoakMin] = useState('');
  const [soakMax, setSoakMax] = useState('');
  const [soakContainer, setSoakContainer] = useState('');

  const getStockCode = (id: string) => stockCodes.find((sc) => sc.id === id);
  const getActiveBom = (stockCodeId: string) => boms.find((b) => b.finished_good_id === stockCodeId && b.status === 'active');

  const getfinishedGoodOptions = stockCodes.filter((sc) => {
    const isFinishedGood = sc.item_type === 'finished_good';
    const hasActiveBom = !!getActiveBom(sc.id);
    return isFinishedGood && hasActiveBom;
    });
  const getOperator = (id?: string | null) => id ? operators.find((o) => o.user_id === id) : undefined;

  useEffect(() => { void loadData(); }, []);

  async function loadData() {
    setLoadingRuns(true);
    try {
      const { data: runsData, error: rErr } = await (supabase.from('fms_pickle_runs' as any) as any).select('*').order('created_at', { ascending: false });
      const { data: stagesData, error: sErr } = await (supabase.from('fms_pickle_stages' as any) as any).select('*');
      const { data: ingData, error: iErr } = await (supabase.from('fms_pickle_stage_ingredients' as any) as any).select('*');
      const { data: usedData, error: uErr } = await (supabase.from('fms_materials_used' as any) as any).select('receiving_record_id, quantity_used');
      const { data: opData, error: oErr } = await (supabase.from('fms_users' as any) as any).select('id, user_id, name, role, is_active').eq('is_active', true);
      if (!rErr && runsData) setRuns(runsData as PickleRun[]);
      if (!sErr && stagesData) setStages(stagesData as PickleStage[]);
      if (!iErr && ingData) setIngredients(ingData as PickleIngredient[]);
      if (!uErr && usedData) setMaterialsUsed((usedData as any[]).map((x) => ({ receiving_record_id: x.receiving_record_id, quantity_used: Number(x.quantity_used) })));
      if (!oErr && opData) setOperators(opData as FMSOperator[]);
    } catch (e) {
      console.error('[Pickle] load error', e);
      toast.error('Failed to load pickle production data');
    } finally {
      setLoadingRuns(false);
    }
  }

  const canCreateRun = fmsUser?.role === 'system_admin' || fmsUser?.role === 'production_supervisor';

  const receivingForLot = (lotId: string) => receivingRecords.find((r) => r.id === lotId);
  const lotAvailable = (lotId?: string | null): number => {
    if (!lotId) return 0;
    let used = materialsUsed.filter((m) => m.receiving_record_id === lotId).reduce((s, m) => s + m.quantity_used, 0);
    used += ingredients.filter((i) => i.receiving_record_id === lotId && i.measured_qty != null).reduce((s, i) => s + Number(i.measured_qty || 0), 0);
    const rec = receivingForLot(lotId);
    return rec ? Math.max(0, Number(rec.quantity_received) - used) : 0;
  };
  const availableLotsFor = (materialStockCodeId: string) =>
    receivingRecords.filter((r) => r.stock_code_id === materialStockCodeId && r.status === 'accepted')
      .sort((a, b) => (a.received_at || '').localeCompare(b.received_at || ''));

  // -----------------------------------------------------------------------
  // Stage tree generation from the active BOM dependency tree
  // -----------------------------------------------------------------------
  let orderCounter = 0;
  const insertStageNode = async (
    runId: string,
    stockCodeId: string,
    requiredQty: number,
    parentStageId: string | null,
    isRoot: boolean,
  ) => {
    const stock = getStockCode(stockCodeId);
    const bom = getActiveBom(stockCodeId);
    const bomAny = bom as any;
    const instructions = (bomAny && Array.isArray(bomAny.processing_steps) && bomAny.processing_steps.length > 0)
      ? bomAny.processing_steps.map((s: any) => `${s.step_name}${s.description ? ': ' + s.description : ''}`).join('\n')
      : '';

    const { data: stageRow, error: stageErr } = await (supabase.from('fms_pickle_stages' as any) as any)
      .insert({
        run_id: runId,
        stock_code_id: stockCodeId,
        parent_stage_id: parentStageId,
        stage_order: ++orderCounter,
        is_root: isRoot,
        required_qty: requiredQty,
        unit_of_measure: stock?.unit_of_measure || 'kg',
        process_instructions: instructions || null,
        status: 'NOT_STARTED',
      })
      .select()
      .single();
    if (stageErr || !stageRow) throw new Error(stageErr?.message || 'Failed to create stage');

    if (bom && bom.components) {
      for (const comp of bom.components) {
        // Percentage BOMs store component values as percentage numbers (e.g. 7 = 7%,
        // 0.15 = 0.15%), so convert to a fraction before scaling by the planned stage
        // quantity. Normal BOMs keep the existing per-batch quantity behaviour.
        const componentValue = Number(comp.quantity_per_batch) || 0;
        const childQty = stock?.bom_uses_percentage === true
          ? (componentValue / 100) * requiredQty
          : componentValue * requiredQty;
        
        const mat = getStockCode(comp.material_stock_code_id);
        const matBom = getActiveBom(comp.material_stock_code_id);
        const manufactured = mat && (mat.item_type === 'work_in_progress' || mat.item_type === 'finished_good') && matBom && matBom.components && matBom.components.length > 0;
        let sourceType = 'receiving';
        let sourceStageId: string | null = null;
        if (manufactured) {
          sourceType = 'wip_stage';
          sourceStageId = await insertStageNode(runId, comp.material_stock_code_id, childQty, stageRow.id, false);
        }
        await (supabase.from('fms_pickle_stage_ingredients' as any) as any).insert({
          stage_id: stageRow.id,
          material_stock_code_id: comp.material_stock_code_id,
          source_type: sourceType,
          source_stage_id: sourceStageId,
          required_qty: childQty,
          unit_of_measure: mat?.unit_of_measure || 'kg',
          status: 'PENDING',
        }).select()
          .single();
      }
    }
    return stageRow.id;
  };

  // -----------------------------------------------------------------------
  // Create a production run (validate finished good + build the BOM tree)
  // -----------------------------------------------------------------------
  const handleCreateRun = async () => {
    const fg = getStockCode(createFG);
    const qty = parseFloat(createQty);
    if (!fg) { toast.error('Please select a finished product'); return; }
    if (!qty || qty <= 0) { toast.error('Planned quantity must be greater than 0'); return; }
    const bom = getActiveBom(fg.id);
    if (!bom) { toast.error(`No active BOM exists for ${fg.stock_code}. Create a BOM first.`); return; }

    setCreating(true);
    try {
      const { data: runRow, error: runErr } = await (supabase.from('fms_pickle_runs' as any) as any)
        .insert({ finished_good_id: fg.id, planned_total_qty: qty, unit_of_measure: fg.unit_of_measure || 'kg', notes: createNotes || null, created_by: user?.id || null })
        .select()
        .single();
      if (runErr || !runRow) throw new Error(runErr?.message || 'Failed to create run');
      orderCounter = 0;
      await insertStageNode(runRow.id, fg.id, qty, null, true);
      toast.success(`Production run ${runRow.run_number} created from BOM dependencies`);
      setCreateOpen(false);
      setCreateFG(''); setCreateQty('1000'); setCreateNotes('');
      setSelectedRunId(runRow.id);
      setSelectedStageId(null);
      await loadData();
      await refreshData();
    } catch (e: any) {
      console.error('[Pickle] create run error', e);
      toast.error(e?.message || 'Failed to create production run');
    } finally {
      setCreating(false);
    }
  };

  const updateStage = async (id: string, patch: any) => {
    const { data, error } = await (supabase.from('fms_pickle_stages' as any) as any).update(patch).eq('id', id).select().single();
    if (error) { console.error('[Pickle] update stage', error); return null; }
    setStages((prev) => prev.map((s) => (s.id === id ? data : s)));
    return data as PickleStage;
  };

  const updateIngredient = async (id: string, patch: any) => {
    const { data, error } = await (supabase.from('fms_pickle_stage_ingredients' as any) as any).update(patch).eq('id', id).select().single();
    if (error) { console.error('[Pickle] update ingredient', error); return null; }
    setIngredients((prev) => prev.map((ing) => (ing.id === id ? data : ing)));
    return data as PickleIngredient;
  };
  

  // -----------------------------------------------------------------------
  // Stage actions
  // -----------------------------------------------------------------------
  const generateLot = async (): Promise<string> => {
    try {
      const { data, error } = await (supabase.rpc as any)('fms_generate_lot_number');
      if (!error && data) return data as string;
    } catch (e) { /* ignore */ }
    const year = new Date().getFullYear();
    return `LOT-${year}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
  };

  const setStageReady = async (stage: PickleStage) => {
    await updateStage(stage.id, { status: 'READY', started_at: stage.started_at || new Date().toISOString(), operator_id: user?.id });
  };
  const beginStage = async (stage: PickleStage) => {
    await updateStage(stage.id, { status: 'IN_PROGRESS', started_at: new Date().toISOString(), operator_id: user?.id });
  };
  const markReadyForNext = async (stage: PickleStage) => {
    const patch: any = { status: 'READY_FOR_NEXT_STAGE' };
    if (stage.is_soaking) {
      patch.actual_ready_date = new Date().toISOString().split('T')[0];
      patch.elapsed_days = stage.min_ready_date ? daysBetween(stage.min_ready_date, new Date().toISOString()) : 0;
    }
    await updateStage(stage.id, patch);
  };
  const applySoak = async () => {
    const stage = pendingSoak;
    if (!stage) return;
    if (!soakMin || !soakMax || !soakContainer) { toast.error('Enter min ready date, max ready date and container'); return; }
    if (new Date(soakMax) < new Date(soakMin)) { toast.error('Max ready date cannot be before min ready date'); return; }
    const patch: any = {
      is_soaking: true,
      status: 'SOAKING',
      soaking_start_at: new Date().toISOString(),
      min_ready_date: soakMin,
      max_ready_date: soakMax,
      container_id: soakContainer,
      started_at: stage.started_at || new Date().toISOString(),
      operator_id: user?.id,
    };
    const updated = await updateStage(stage.id, patch);
    if (updated) toast.success(`${stageName(stage)} — SOAKING started in ${soakContainer}`);
    setPendingSoak(null); setSoakMin(''); setSoakMax(''); setSoakContainer('');
  };

  const weighIngredient = async (ing: PickleIngredient, measured: string) => {
    const m = parseFloat(measured);
    if (isNaN(m) || m < 0) { toast.error('Enter a valid measured quantity'); return; }
    const variance = m - Number(ing.required_qty);
    await updateIngredient(ing.id, {
      measured_qty: m,
      variance,
      status: 'WEIGHED',
      operator_id: user?.id,
      measured_at: new Date().toISOString(),
    });
  };

  const assignIngredientLot = async (ing: PickleIngredient, lotId: string) => {
    const rec = receivingForLot(lotId);
    await updateIngredient(ing.id, { receiving_record_id: lotId, internal_lot_number: rec?.internal_lot_number || null });
  };

  const cascadeRunStatus = async (runId: string) => {
    const runStages = stages.filter((s) => s.run_id === runId);
    const run = runs.find((r) => r.id === runId);
    if (runStages.length === 0 || !run) return;
    const allDone = runStages.every((s) => s.status === 'COMPLETED');
    const anyStarted = runStages.some((s) => s.status !== 'NOT_STARTED');
    const patch: any = {};
    if (allDone) { patch.status = 'COMPLETED'; patch.completed_at = new Date().toISOString(); }
    else if (anyStarted && run.status === 'PLANNED') { patch.status = 'IN_PROGRESS'; patch.started_at = new Date().toISOString(); }
    if (!Object.keys(patch).length) return;
    const { data, error } = await (supabase.from('fms_pickle_runs' as any) as any).update(patch).eq('id', runId).select().single();
    if (error) { console.error('[Pickle] run status update', error); return; }
    setRuns((prev) => prev.map((r) => (r.id === runId ? data : r)));
  };
  

  const stageName = (stage: PickleStage) => getStockCode(stage.stock_code_id)?.stock_code || 'Stage';

  // -----------------------------------------------------------------------
  // Complete a stage: consume inputs, create output lot, mark COMPLETED
  // -----------------------------------------------------------------------
  const completeStage = async (stage: PickleStage) => {
    if (busyStageId) return;
    if (!(verifyMap[stage.id] ?? stage.verified)) { toast.error('Verification checkbox must be ticked before completing this stage.'); return; }
    if (stage.status === 'COMPLETED') return;
    setBusyStageId(stage.id);
    try {
      const run = runs.find((r) => r.id === stage.run_id);
      const runNumber = run?.run_number || 'PCK';
      const stageStock = getStockCode(stage.stock_code_id);
      const stageIngredients = ingredients.filter((i) => i.stage_id === stage.id);
      const unweighed = stageIngredients.some((i) => i.measured_qty == null || i.measured_qty <= 0);
      const missingLot = stageIngredients.some((i) => !i.receiving_record_id);
      if (unweighed) throw new Error('All ingredients must have an actual measured quantity.');
      if (missingLot) throw new Error('All ingredients must have a lot assigned.');

      for (const ing of stageIngredients) {
        const { error } = await (supabase.rpc as any)('fms_apply_stock_movement', {
          p_stock_code_id: ing.material_stock_code_id,
          p_movement_type: 'batch_usage',
          p_quantity_change: -Number(ing.measured_qty || 0),
          p_reference_id: ing.internal_lot_number || '',
          p_notes: `Pickle ${runNumber} ${stageStock?.stock_code || ''} consumed ${fmtNum(ing.measured_qty)} from ${ing.internal_lot_number || 'lot'}`,
          p_created_by: user?.id || null,
        });
        if (error) console.error('[Pickle] consume movement', error);
        await updateIngredient(ing.id, { status: 'COMPLETED' });
      }

      const completedQty = Number(stage.completed_quantity || stage.required_qty) || 0;
      if (completedQty <= 0) throw new Error('Completed quantity must be greater than 0.');
      if (stageStock && stageStock.item_type !== 'raw_material' && stageStock.item_type !== 'packaging') {
        const lotNumber = await generateLot();
        const { data: lotRow, error: lotErr } = await (supabase.from('fms_receiving' as any) as any)
          .insert({
            internal_lot_number: lotNumber,
            stock_code_id: stage.stock_code_id,
            quantity_received: completedQty,
            supplier_id: null,
            supplier_batch_number: null,
            expiry_date: null,
            quality_checks: {},
            status: 'accepted',
            received_by: user?.id,
          })
          .select()
          .single();
        if (lotErr || !lotRow) throw new Error(lotErr?.message || 'Failed to create output lot');
        const { error: stockErr } = await (supabase.rpc as any)('fms_apply_stock_movement', {
          p_stock_code_id: stage.stock_code_id,
          p_movement_type: 'receipt',
          p_quantity_change: completedQty,
          p_reference_id: lotNumber,
          p_notes: `Pickle ${runNumber} ${stageStock?.stock_code || ''} output ${fmtNum(completedQty)} → ${lotNumber}`,
          p_created_by: user?.id || null,
        });
        if (stockErr) console.error('[Pickle] output movement', stockErr);

        const downstream = ingredients.filter((i) => i.source_stage_id === stage.id);
        for (const d of downstream) {
          await updateIngredient(d.id, { receiving_record_id: lotRow.id, internal_lot_number: lotNumber });
        }

        await updateStage(stage.id, {
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          completed_quantity: completedQty,
          output_lot_id: lotRow.id,
          actual_ready_date: stage.is_soaking ? new Date().toISOString().split('T')[0] : stage.actual_ready_date,
          elapsed_days: stage.is_soaking ? (stage.min_ready_date ? daysBetween(stage.min_ready_date, new Date().toISOString()) : null) : stage.elapsed_days,
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
        });
        toast.success(`${stageStock?.stock_code || 'Stage'} completed — output lot ${lotNumber} created`);
      } else {
        await updateStage(stage.id, { status: 'COMPLETED', completed_at: new Date().toISOString(), completed_quantity: completedQty });
      }

      await cascadeRunStatus(stage.run_id);
      await loadData();
      await refreshData();
    } catch (e: any) {
      console.error('[Pickle] complete stage', e);
      toast.error(e?.message || 'Failed to complete stage');
    } finally {
      setBusyStageId(null);
    }
  };
  

  const [measuredInputs, setMeasuredInputs] = useState<Record<string, string>>({});
  const [completedQtyInputs, setCompletedQtyInputs] = useState<Record<string, string>>({});
  const [verifyMap, setVerifyMap] = useState<Record<string, boolean>>({});

  const selectedRun = selectedRunId ? runs.find((r) => r.id === selectedRunId) : null;
  const runStages = selectedRunId ? stages.filter((s) => s.run_id === selectedRunId) : [];
  const ingredientsFor = (stageId: string) => ingredients.filter((i) => i.stage_id === stageId);

  const filteredRuns = runs.filter((r) => {
    const fg = getStockCode(r.finished_good_id);
    const q = searchQuery.toLowerCase();
    return r.run_number.toLowerCase().includes(q) || (fg?.stock_code || '').toLowerCase().includes(q) || (fg?.description || '').toLowerCase().includes(q);
  });

  const progressOf = (runId: string) => {
    const rs = stages.filter((s) => s.run_id === runId);
    if (rs.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = rs.filter((s) => s.status === 'COMPLETED').length;
    return { done, total: rs.length, pct: Math.round((done / rs.length) * 100) };
  };

  // "SOAKING — Day 4 of 7–10"
  const soakingLabel = (stage: PickleStage): string | null => {
    if (stage.status !== 'SOAKING' || !stage.soaking_start_at) return null;
    const day = daysBetween(stage.soaking_start_at, new Date().toISOString());
    let label = `Day ${day}`;
    if (stage.min_ready_date) {
      const minDays = stage.max_ready_date
        ? `${daysBetween(stage.min_ready_date, stage.max_ready_date)}`
        : '';
      label += ` of ${daysBetween(stage.soaking_start_at, stage.min_ready_date)}${minDays ? '–' + daysBetween(stage.soaking_start_at, stage.max_ready_date) : ''}`;
    }
    return label;
  };
  

  // ---------------------------------------------------------------------
  // Start -> end ordered stage list
  // ---------------------------------------------------------------------
  const orderedStages = (() => {
    if (!selectedRun) return [] as PickleStage[];
    const byId = new Map<string, PickleStage>();
    runStages.forEach((s) => byId.set(s.id, s));
    const stageDepth = (s: PickleStage): number => {
      let d = 0;
      let cur: PickleStage | undefined = s;
      const seen = new Set<string>([s.id]);
      while (cur?.parent_stage_id && byId.has(cur.parent_stage_id) && !seen.has(cur.parent_stage_id)) {
        seen.add(cur.parent_stage_id);
        cur = byId.get(cur.parent_stage_id);
        d++;
      }
      return d;
    };
    // Start -> end: the deepest stages (raw-side WIP like brines) come first and
    // the finished good (depth 0) comes last, matching the physical process.
    return runStages.slice().sort((a, b) => {
      const da = stageDepth(a);
      const db = stageDepth(b);
      if (da !== db) return db - da;
      if (a.stage_order !== b.stage_order) return a.stage_order - b.stage_order;
      return runStages.indexOf(a) - runStages.indexOf(b);
    });
  })();

  const currentStage = orderedStages.find((s) => s.status !== 'COMPLETED') || null;
  const openStage = (selectedStageId ? runStages.find((s) => s.id === selectedStageId) : null) || currentStage || runStages[0] || null;

  // ---------------------------------------------------------------------
  // Ingredient row (used inside the selected stage's weighing table)
  // ---------------------------------------------------------------------
  const ingredientRow = (ing: PickleIngredient) => {
    const mat = getStockCode(ing.material_stock_code_id);
    const isWip = ing.source_type === 'wip_stage';
    const srcStage = isWip ? runStages.find((s) => s.id === ing.source_stage_id) : null;
    const lots = isWip ? [] : availableLotsFor(ing.material_stock_code_id);
    const measuredVal = measuredInputs[ing.id] ?? (ing.measured_qty != null ? ing.measured_qty.toString() : '');
    const variance = (ing.measured_qty != null) ? (Number(ing.measured_qty) - Number(ing.required_qty)) : null;

    return (
      <tr key={ing.id} className="border-t border-border/60">
        <td className="py-2 pr-3 align-top">
          <p className="text-sm font-medium">{mat?.stock_code || '-'}</p>
          <p className="text-xs text-muted-foreground">{mat?.description || ''}</p>
          {isWip && <Badge variant="outline" className="mt-1 text-[10px] text-primary">From {srcStage ? (getStockCode(srcStage.stock_code_id)?.stock_code || 'WIP') : 'WIP stage'}</Badge>}
        </td>
        <td className="py-2 pr-3 align-top text-sm font-semibold whitespace-nowrap">
          {fmtNum(ing.required_qty)} <span className="text-xs font-normal text-muted-foreground">{ing.unit_of_measure}</span>
        </td>
        <td className="py-2 pr-3 align-top">
          <Input className="h-9 w-24" type="number" min="0" step="0.001" value={measuredVal}
            onChange={(e) => setMeasuredInputs((prev) => ({ ...prev, [ing.id]: e.target.value }))}
            onBlur={() => { if (measuredVal !== '') void weighIngredient(ing, measuredVal); }} placeholder="0.000" />
        </td>
        <td className={`py-2 pr-3 align-top text-sm font-semibold whitespace-nowrap ${variance == null ? 'text-muted-foreground' : (Math.abs(variance) < 0.001 ? 'text-emerald-600' : 'text-amber-600')}`}>
          {variance == null ? '-' : (variance >= 0 ? '+' : '') + fmtNum(variance, 2)}
        </td>
        <td className="py-2 align-top">
          {isWip ? (
            <p className="text-xs font-medium">{ing.internal_lot_number || (ing.status === 'COMPLETED' ? 'Consumed' : 'From upstream stage')}</p>
          ) : (
            <Select value={ing.receiving_record_id || ''} onValueChange={(v) => void assignIngredientLot(ing, v)}>
              <SelectTrigger className="h-9 w-full min-w-[9rem]"><SelectValue placeholder="Select lot..." /></SelectTrigger>
              <SelectContent>
                {lots.length === 0 && <SelectItem value="">No accepted lots</SelectItem>}
                {lots.map((lot) => (
                  <SelectItem key={lot.id} value={lot.id}>{lot.internal_lot_number} - avail {fmtNum(lotAvailable(lot.id))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </td>
      </tr>
    );
  };

  // ---------------------------------------------------------------------
  // Compact stage row for the start -> end flow list
  // ---------------------------------------------------------------------
  const stageRow = (stage: PickleStage, index: number) => {
    const sc = getStockCode(stage.stock_code_id);
    const done = stage.status === 'COMPLETED';
    const isOpen = openStage?.id === stage.id;
    const isCurrent = currentStage?.id === stage.id;
    const soakLbl = soakingLabel(stage);

    return (
      <button key={stage.id} type="button" onClick={() => setSelectedStageId(stage.id)}
        className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${isOpen ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? 'bg-emerald-600 text-white' : isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          {done ? 'OK' : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold">{sc?.stock_code}</span>
            {stage.is_root && <Badge variant="outline" className="text-[10px]">Finished good</Badge>}
            {isCurrent && <Badge className="text-[10px]">Current step</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">{sc?.description}</p>
          {soakLbl && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary">
              <Timer className="h-3 w-3" />SOAKING - {soakLbl}{stage.container_id ? ` | ${stage.container_id}` : ''}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold whitespace-nowrap">{fmtNum(stage.required_qty)} {stage.unit_of_measure}</p>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_BADGE[stage.status]}`}>{STAGE_LABEL[stage.status]}</span>
        </div>
      </button>
    );
  };

  // ---------------------------------------------------------------------
  // Detail panel for the currently open stage
  // ---------------------------------------------------------------------
  const stagePanel = openStage ? (() => {
    const stage = openStage;
    const sc = getStockCode(stage.stock_code_id);
    const ings = ingredientsFor(stage.id);
    const verified = verifyMap[stage.id] ?? stage.verified;
    const soakLbl = soakingLabel(stage);
    const op = getOperator(stage.operator_id);
    const completedVal = completedQtyInputs[stage.id] ?? (stage.completed_quantity != null ? stage.completed_quantity.toString() : (stage.required_qty || 0).toString());
    const done = stage.status === 'COMPLETED';
    const active = ['READY', 'IN_PROGRESS', 'SOAKING', 'READY_FOR_NEXT_STAGE'].includes(stage.status);
    const canComplete = ['READY', 'IN_PROGRESS', 'SOAKING', 'READY_FOR_NEXT_STAGE'].includes(stage.status);
    const outLot = stage.output_lot_id ? receivingForLot(stage.output_lot_id) : undefined;
    const parent = stage.parent_stage_id ? runStages.find((s) => s.id === stage.parent_stage_id) : null;

    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_BADGE[stage.status]}`}>{STAGE_LABEL[stage.status]}</span>
              <span className="text-base font-semibold">{sc?.stock_code}</span>
              {stage.is_root && <Badge>Finished good</Badge>}
              {stage.is_soaking && <Badge variant="outline">Soaking stage</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{sc?.description}</p>
            <p className="mt-1 text-sm">Required: <strong>{fmtNum(stage.required_qty)} {stage.unit_of_measure}</strong></p>
            {parent && <p className="text-xs text-muted-foreground">Feeds into {getStockCode(parent.stock_code_id)?.stock_code}</p>}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {op && <p>Operator: <span className="font-medium text-foreground">{op.name}</span></p>}
            {stage.started_at && <p>Started {formatDateTime(stage.started_at)}</p>}
            {stage.completed_at && <p>Completed {formatDateTime(stage.completed_at)}</p>}
          </div>
        </div>

        {soakLbl && (
          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Timer className="h-4 w-4 text-primary" />
              <strong>SOAKING - {soakLbl}</strong>
              {stage.container_id && <span className="text-muted-foreground">| Container {stage.container_id}</span>}
            </p>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
              <div><Label className="text-xs">Soak started</Label><p>{stage.soaking_start_at ? formatDateTime(stage.soaking_start_at) : '-'}</p></div>
              <div><Label className="text-xs">Min ready</Label><p>{stage.min_ready_date || '-'}</p></div>
              <div><Label className="text-xs">Max ready</Label><p>{stage.max_ready_date || '-'}</p></div>
              <div><Label className="text-xs">Container / Drum</Label><p className="font-medium">{stage.container_id || '-'}</p></div>
            </div>
          </div>
        )}

        {ings.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-muted-foreground">Ingredients - weigh each one</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground">
                    <th className="pb-1 pr-3 font-medium">Ingredient</th>
                    <th className="pb-1 pr-3 font-medium">Required</th>
                    <th className="pb-1 pr-3 font-medium">Actual measured</th>
                    <th className="pb-1 pr-3 font-medium">Variance</th>
                    <th className="pb-1 font-medium">Lot</th>
                  </tr>
                </thead>
                <tbody>{ings.map(ingredientRow)}</tbody>
              </table>
            </div>
          </div>
        )}

        {stage.process_instructions && (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 p-3">
            <p className="text-sm font-semibold text-muted-foreground">Process instructions</p>
            <pre className="whitespace-pre-wrap font-sans text-sm">{stage.process_instructions}</pre>
          </div>
        )}

        {!done && (
          <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-border pt-3">
            <div className="space-y-1">
              <Label className="text-xs">Completed qty ({stage.unit_of_measure})</Label>
              <Input className="h-9 w-28" type="number" min="0" step="0.001" value={completedVal}
                onChange={(e) => setCompletedQtyInputs((prev) => ({ ...prev, [stage.id]: e.target.value }))} />
            </div>
            {active && (
              <div className="flex items-center gap-2 pb-2">
                <Checkbox id={`verify-${stage.id}`} checked={verified} onCheckedChange={(c) => setVerifyMap((prev) => ({ ...prev, [stage.id]: !!c }))} />
                <Label htmlFor={`verify-${stage.id}`} className="text-sm font-normal">Verified by {fmsUser?.name || 'operator'}</Label>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {stage.status === 'NOT_STARTED' && <Button onClick={() => void setStageReady(stage)}>Start stage</Button>}
          {stage.status === 'READY' && <Button onClick={() => void beginStage(stage)}><Play className="mr-1 h-4 w-4" />Begin</Button>}
          {active && !stage.is_soaking && stage.status !== 'SOAKING' && (
            <Button variant="outline" onClick={() => { setPendingSoak(stage); setSoakMin(''); setSoakMax(''); setSoakContainer(stage.container_id || ''); }}>
              <Timer className="mr-1 h-4 w-4" />Begin Soaking
            </Button>
          )}
          {stage.status === 'SOAKING' && <Button variant="outline" onClick={() => void markReadyForNext(stage)}>Ready for next stage</Button>}
          {canComplete && (
            <Button disabled={busyStageId === stage.id} onClick={() => void completeStage(stage)}>
              {busyStageId === stage.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
              Complete stage
            </Button>
          )}
        </div>

        {done && (
          <div className="mt-3 rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-3 text-sm">
            <p className="font-medium text-emerald-700">Stage complete - {fmtNum(stage.completed_quantity)} {stage.unit_of_measure} produced</p>
            {outLot && (
              <p className="mt-1 flex flex-wrap items-center gap-2">
                <span>Output lot: <strong>{outLot.internal_lot_number}</strong></span>
                <Button variant="outline" size="sm" onClick={() => void viewLotQR(stage)}>Lot QR</Button>
              </p>
            )}
          </div>
        )}
      </div>
    );
  })() : null;


  const viewLotQR = async (stage: PickleStage) => {
    const lot = stage.output_lot_id ? receivingForLot(stage.output_lot_id) : undefined;
    const data = JSON.stringify({
      type: 'PICKLE_LOT',
      lot: lot?.internal_lot_number || '',
      stock_code: getStockCode(stage.stock_code_id)?.stock_code || '',
      quantity: stage.completed_quantity,
      run: runs.find((r) => r.id === stage.run_id)?.run_number || '',
    });
    const img = await generateQRCodeImage(data);
    if (!img) { toast.error('Could not generate QR'); return; }
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Lot QR</title></head><body style="text-align:center;font-family:sans-serif;padding:24px;">
      <h3>${escapeHtml2(lot?.internal_lot_number || '')}</h3><img src="${img}" style="width:300px;height:300px;image-rendering:pixelated;" />
      <p>${escapeHtml2(getStockCode(stage.stock_code_id)?.stock_code || '')} · ${escapeHtml2(String(stage.completed_quantity))} ${escapeHtml2(stage.unit_of_measure)}</p>
      <button onclick="window.print()">Print</button></body></html>`);
    w.document.close();
  };

  const escapeHtml2 = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const runListView = (
    <div className="space-y-4">
      {filteredRuns.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Factory className="mx-auto mb-2 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No pickle production runs yet. Create one to auto-generate stages from the BOM dependency tree.</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredRuns.map((run) => {
          const fg = getStockCode(run.finished_good_id);
          const prog = progressOf(run.id);
          const statusClass = run.status === 'COMPLETED' ? 'badge-active' : (run.status === 'CANCELLED' ? 'badge-inactive' : 'badge-active');
          return (
            <button key={run.id} type="button" onClick={() => { setSelectedRunId(run.id); setSelectedStageId(null); }}
              className="rounded-xl border border-border bg-card p-4 text-left hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{run.run_number}</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>{run.status.replace('_', ' ')}</span>
              </div>
              <div className="mt-1 text-sm">
                <span className="font-medium text-foreground">{fg?.stock_code}</span>
                <span className="text-muted-foreground"> · {fg?.description}</span>
              </div>
              <p className="mt-1 text-sm"><strong>{fmtNum(run.planned_total_qty)} {run.unit_of_measure}</strong> planned</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${prog.pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{prog.done}/{prog.total} stages</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(run.created_at)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
  

  const detailView = selectedRun ? (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={() => { setSelectedRunId(null); setSelectedStageId(null); }}>
        <ArrowLeft className="mr-1 h-4 w-4" />Back to runs
      </Button>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold">{selectedRun.run_number}</span>
              <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium badge-active">{selectedRun.status.replace('_', ' ')}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {getStockCode(selectedRun.finished_good_id)?.stock_code} - {getStockCode(selectedRun.finished_good_id)?.description}
            </p>
            {selectedRun.notes && <p className="text-xs text-muted-foreground">{selectedRun.notes}</p>}
          </div>
          <div className="text-right text-sm">
            <strong>{fmtNum(selectedRun.planned_total_qty)} {selectedRun.unit_of_measure}</strong> planned
            {selectedRun.started_at && <p className="text-xs text-muted-foreground">Started {formatDateTime(selectedRun.started_at)}</p>}
          </div>
        </div>
        {(() => {
          const p = progressOf(selectedRun.id);
          return (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Stage progress</span>
                <span className="font-medium text-foreground">{p.done} of {p.total} stages done ({p.pct}%)</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${p.pct}%` }} />
              </div>
            </div>
          );
        })()}
        {currentStage && selectedRun.status !== 'COMPLETED' && (
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            Current stage: <strong>{getStockCode(currentStage.stock_code_id)?.stock_code}</strong>
            <span className="text-muted-foreground"> - {getStockCode(currentStage.stock_code_id)?.description}</span>
          </div>
        )}
      </div>

      {runStages.length === 0 && (
        <div className="rounded-xl border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No stages generated for this run.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-5">
          <p className="text-sm font-semibold text-muted-foreground">Production stages (start to finish)</p>
          {orderedStages.map(stageRow)}
        </div>
        <div className="lg:col-span-7">
          {stagePanel || (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">Select a stage on the left to weigh ingredients and complete it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;
  if (loadingRuns) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading pickle production...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in px-2 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-semibold">Pickle Production</p>
          <p className="text-sm text-muted-foreground">One run → stages auto-generated from BOM dependencies</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!selectedRun && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search runs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 w-56" />
              </div>
              {canCreateRun && (
                <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" />New Production Run</Button>
              )}
            </>
          )}
        </div>
      </div>

      {selectedRun ? detailView : runListView}

      {/* Create run dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>New Production Run</DialogTitle>
            <DialogDescription>Create one run; stages are generated from the finished product's active BOM tree (WIP + raw dependencies).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
  <Label>Finished Product *</Label>
  <Select value={createFG} onValueChange={(v) => setCreateFG(v)}>
    <SelectTrigger>
      <SelectValue placeholder="Select finished good..." />
    </SelectTrigger>

    <SelectContent>
      {stockCodes.filter((sc) => {
        const isFinishedGood = sc.item_type === 'finished_good';
        const hasActiveBom = boms.some(
          (b) =>
            b.finished_good_id === sc.id &&
            b.status === 'active'
        );

        return isFinishedGood && hasActiveBom;
      }).length === 0 && (
        <SelectItem value="none" disabled>
          No finished goods
        </SelectItem>
      )}

      {stockCodes
        .filter((sc) => {
          const isFinishedGood = sc.item_type === 'finished_good';
          const hasActiveBom = boms.some(
            (b) =>
              b.finished_good_id === sc.id &&
              b.status === 'active'
          );

          return isFinishedGood && hasActiveBom;
        })
        .map((fg) => (
          <SelectItem key={fg.id} value={fg.id}>
            {fg.stock_code} — {fg.description}
          </SelectItem>
        ))}
    </SelectContent>
  </Select>
</div>
            <div className="space-y-2">
              <Label>Planned quantity (kg) *</Label>
              <Input type="number" min="0" step="0.01" value={createQty} onChange={(e) => setCreateQty(e.target.value)} placeholder="e.g. 1000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run_notes">Notes</Label>
              <Textarea id="run_notes" value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="Optional notes for this run" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={creating} onClick={() => void handleCreateRun()}>
              {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Factory className="mr-1 h-4 w-4" />}
              Generate Stages
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Begin soaking dialog */}
      <Dialog open={!!pendingSoak} onOpenChange={(o) => { if (!o) setPendingSoak(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Begin Soaking — {pendingSoak ? stageName(pendingSoak) : ''}</DialogTitle>
            <DialogDescription>Soaking stages run for several days. Record the ready window and container.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="soak_min">Min ready date *</Label>
                <Input id="soak_min" type="date" value={soakMin} onChange={(e) => setSoakMin(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="soak_max">Max ready date *</Label>
                <Input id="soak_max" type="date" value={soakMax} onChange={(e) => setSoakMax(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="soak_container">Container / Drum ID *</Label>
              <Input id="soak_container" value={soakContainer} onChange={(e) => setSoakContainer(e.target.value.toUpperCase())} placeholder="e.g. DRUM-014" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingSoak(null)}>Cancel</Button>
            <Button onClick={() => void applySoak()}><Timer className="mr-1 h-4 w-4" />Start Soaking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PickleProduction;
