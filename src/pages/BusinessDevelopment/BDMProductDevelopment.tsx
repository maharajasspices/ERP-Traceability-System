
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Calculator,
  Package,
  Beaker,
  Search,
  ArrowLeft,
  FileSpreadsheet,
  Layers,
  Loader2,
  CheckCircle2,
  XCircle,
  ClipboardList,
  FlaskConical,
  Copy,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type Status =
  | 'draft'
  | 'testing'
  | 'approved'
  | 'rejected'
  | 'pending_approval'
  | 'archived';

type Ingredient = {
  id: string;
  stock_code_id: string | null;
  stock_code: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  supplier: string;
  notes: string;
  source: 'stock' | 'manual';
  price: number;
  price_unit: string;
};

type RecipeStage = {
  id: string;
  stage_number: number;
  stage_name: string;
  instructions: string;
  duration_minutes: number;
  temperature: string;
  ingredients: Ingredient[];
};

type StockItem = {
  id: string;
  stock_code: string;
  description: string;
  unit_of_measure: string;
  latest_cost: number;
};

type Development = {
  id: string;
  parent_id: string | null;
  record_type: 'master' | 'revision';
  product_name: string;
  product_code: string | null;
  product_category: string | null;
  description: string | null;
  recipe_data: any;
  costing_data: Record<string, any>;
  trial_data: Record<string, any>;
  specifications_data: Record<string, any>;
  status: Status;
  version: number;
  is_current: boolean;
  change_notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

type View = 'overview' | 'recipes' | 'workspace' | 'costing';

const CURRENCY = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
});

const UNIT_OPTIONS = ['g', 'kg', 'ml', 'l', 'each'];

const makeId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createIngredient = (): Ingredient => ({
  id: makeId(),
  stock_code_id: null,
  stock_code: '',
  ingredient_name: '',
  quantity: 0,
  unit: 'kg',
  supplier: '',
  notes: '',
  source: 'manual',
  price: 0,
  price_unit: 'kg',
});

const createStage = (number: number): RecipeStage => ({
  id: makeId(),
  stage_number: number,
  stage_name: '',
  instructions: '',
  duration_minutes: 0,
  temperature: '',
  ingredients: [createIngredient()],
});

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    draft: 'Draft',
    testing: 'In trial',
    approved: 'Approved',
    rejected: 'Rejected',
    pending_approval: 'Pending approval',
    archived: 'Archived',
  };

  return labels[status] || status;
};

const statusStyle = (status: string) => {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    testing: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-700',
    pending_approval: 'bg-blue-100 text-blue-700',
    archived: 'bg-gray-100 text-gray-500',
  };

  return styles[status] || styles.draft;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not recorded';

  return new Date(value).toLocaleString('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const convertQuantity = (
  quantity: number,
  fromUnit: string,
  priceUnit: string
) => {
  const from = fromUnit.toLowerCase();
  const to = priceUnit.toLowerCase();

  if (from === to) return quantity;

  if (from === 'g' && to === 'kg') return quantity / 1000;
  if (from === 'kg' && to === 'g') return quantity * 1000;
  if (from === 'ml' && to === 'l') return quantity / 1000;
  if (from === 'l' && to === 'ml') return quantity * 1000;

  return quantity;
};

const BDMProductDevelopment = () => {
  const [view, setView] = useState<View>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [versions, setVersions] = useState<Development[]>([]);
  const [allApprovedVersions, setAllApprovedVersions] = useState<Development[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [showRecipeForm, setShowRecipeForm] = useState(false);

  const [batchSize, setBatchSize] = useState(100);
  const [recipeStages, setRecipeStages] = useState<RecipeStage[]>([]);
  const [versionNote, setVersionNote] = useState('');

  const [trialNotes, setTrialNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [correctionPlan, setCorrectionPlan] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);

  const [costingNotes, setCostingNotes] = useState('');

  const selectedRecipe = developments.find(
    (item) => item.id === selectedId
  );

  const selectedVersion = versions.find(
    (item) => item.id === selectedVersionId
  );

  const nextVersionNumber =
    Math.max(0, ...versions.map((item) => Number(item.version || 0))) + 1;

  const allIngredients = useMemo(
    () => recipeStages.flatMap((stage) => stage.ingredients || []),
    [recipeStages]
  );

  const ingredientCost = (ingredient: Ingredient) => {
    const converted = convertQuantity(
      Number(ingredient.quantity || 0),
      ingredient.unit,
      ingredient.price_unit
    );

    return converted * Number(ingredient.price || 0);
  };

  const totalIngredientCost = useMemo(
    () =>
      allIngredients.reduce(
        (total, ingredient) => total + ingredientCost(ingredient),
        0
      ),
    [allIngredients]
  );

  const costPerKg =
    batchSize > 0 ? totalIngredientCost / batchSize : 0;

  const filteredDevelopments = developments.filter((item) =>
    `${item.product_name} ${item.product_category || ''} ${item.product_code || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const renderStatus = (status: string) => (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(status)}`}
    >
      {statusLabel(status)}
    </span>
  );

  useEffect(() => {
    const initialise = async () => {
      setLoading(true);
      await Promise.all([
        loadDevelopments(),
        loadStockItems(),
        loadAllApprovedVersions(),
      ]);
      setLoading(false);
    };

    initialise();
  }, []);

  const loadDevelopments = async () => {
    const { data, error } = await (supabase as any)
      .from('fms_bdm_developments')
      .select('*')
      .eq('record_type', 'master')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error(error);
      toast.error('Could not load recipes.');
      return;
    }

    setDevelopments((data || []) as Development[]);
  };

  const loadStockItems = async () => {
    try {
      const { data: codes, error } = await supabase
        .from('fms_stock_codes')
        .select('id, stock_code, description, unit_of_measure')
        .eq('status', 'active')
        .order('description');

      if (error) throw error;

      const { data: receiving, error: receivingError } = await supabase
        .from('fms_receiving')
        .select('stock_code_id, cost_price_per_kg, received_at')
        .not('cost_price_per_kg', 'is', null)
        .order('received_at', { ascending: false });

      if (receivingError) throw receivingError;

      const latestCosts = new Map<string, number>();

      (receiving || []).forEach((record: any) => {
        if (
          record.stock_code_id &&
          record.cost_price_per_kg !== null &&
          !latestCosts.has(record.stock_code_id)
        ) {
          latestCosts.set(
            record.stock_code_id,
            Number(record.cost_price_per_kg)
          );
        }
      });

      setStockItems(
        (codes || []).map((item: any) => ({
          id: item.id,
          stock_code: item.stock_code,
          description: item.description,
          unit_of_measure: item.unit_of_measure || 'kg',
          latest_cost: latestCosts.get(item.id) || 0,
        }))
      );
    } catch (error) {
      console.error('Stock loading error:', error);
      toast.error('Could not load ERP ingredients.');
    }
  };

  const loadVersions = async (masterId: string) => {
    const { data, error } = await (supabase as any)
      .from('fms_bdm_developments')
      .select('*')
      .eq('parent_id', masterId)
      .eq('record_type', 'revision')
      .order('version', { ascending: false });

    if (error) {
      console.error(error);
      toast.error('Could not load recipe versions.');
      return [];
    }

    const result = (data || []) as Development[];
    setVersions(result);
    return result;
  };

  const loadAllApprovedVersions = async () => {
    const { data, error } = await (supabase as any)
      .from('fms_bdm_developments')
      .select('*')
      .eq('record_type', 'revision')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setAllApprovedVersions((data || []) as Development[]);
  };

  const clearVersionForm = () => {
    setSelectedVersionId(null);
    setBatchSize(100);
    setRecipeStages([]);
    setVersionNote('');
    setTrialNotes('');
    setRejectionReason('');
    setCorrectionPlan('');
    setShowRejectionForm(false);
    setCostingNotes('');
  };

  const openRecipe = async (recipe: Development) => {
    setSelectedId(recipe.id);
    setProductName(recipe.product_name || '');
    setProductCategory(recipe.product_category || '');
    setDescription(recipe.description || '');
    setOwner(recipe.specifications_data?.owner || '');

    clearVersionForm();

    const loaded = await loadVersions(recipe.id);
    const current = loaded.find((item) => item.is_current);

    setView('workspace');

    if (current) openVersion(current);
  };

  const openVersion = (version: Development) => {
    setSelectedVersionId(version.id);

    const recipe = version.recipe_data || {};

    setBatchSize(Number(recipe.batch_size_kg || 100));

    const savedStages = Array.isArray(recipe.stages)
      ? recipe.stages
      : [];

    let loadedStages: RecipeStage[] = savedStages.map(
      (stage: any, index: number) => ({
        ...createStage(index + 1),
        ...stage,
        id: stage.id || makeId(),
        stage_number: index + 1,
        instructions: stage.instructions || stage.process || '',
        ingredients: Array.isArray(stage.ingredients)
          ? stage.ingredients.map((item: any) => ({
              ...createIngredient(),
              ...item,
              id: item.id || makeId(),
              stock_code: item.stock_code || '',
              quantity: Number(item.quantity || 0),
              price: Number(item.price || 0),
              price_unit: item.price_unit || item.unit || 'kg',
            }))
          : [],
      })
    );

    // Support older versions where ingredients were stored outside stages.
    if (
      loadedStages.length &&
      !loadedStages.some((stage) => stage.ingredients.length) &&
      Array.isArray(recipe.ingredients) &&
      recipe.ingredients.length
    ) {
      loadedStages[0].ingredients = recipe.ingredients.map((item: any) => ({
        ...createIngredient(),
        ...item,
        id: item.id || makeId(),
        stock_code: item.stock_code || '',
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        price_unit: item.price_unit || item.unit || 'kg',
      }));
    }

    setRecipeStages(loadedStages);

    const trial = version.trial_data || {};

    setTrialNotes(trial.trial_notes || '');
    setRejectionReason(trial.rejection_reason || '');
    setCorrectionPlan(trial.correction_plan || '');
    setVersionNote(version.change_notes || '');
    setShowRejectionForm(false);
    setCostingNotes(version.costing_data?.costing_notes || '');
  };

  const createRecipe = async () => {
    if (!productName.trim()) {
      toast.error('Please enter a recipe name.');
      return;
    }

    try {
      setSaving(true);

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await (supabase as any)
        .from('fms_bdm_developments')
        .insert({
          product_name: productName.trim(),
          product_code: null,
          product_category: productCategory.trim() || null,
          description: description.trim() || null,
          recipe_data: {
            batch_size_kg: 100,
            ingredients: [],
            stages: [],
          },
          costing_data: {},
          trial_data: {},
          specifications_data: {
            owner: owner.trim(),
          },
          record_type: 'master',
          parent_id: null,
          version: 1,
          is_current: true,
          status: 'draft',
          created_by: userData.user?.id || null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Recipe folder created.');
      await loadDevelopments();

      setShowRecipeForm(false);
      setSelectedId(data.id);
      setVersions([]);
      clearVersionForm();
      setRecipeStages([createStage(1)]);
      setView('workspace');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Could not create recipe.');
    } finally {
      setSaving(false);
    }
  };

  const startVersion = () => {
    if (!selectedId) {
      toast.error('Please open a recipe first.');
      return;
    }

    clearVersionForm();
    setBatchSize(100);
    setRecipeStages([createStage(1)]);
    setView('workspace');
  };

  const copyVersion = (version: Development) => {
    openVersion(version);

    setSelectedVersionId(null);
    setVersionNote(`Copied from V${version.version}`);

    const recipe = version.recipe_data || {};

    setBatchSize(Number(recipe.batch_size_kg || 100));

    setRecipeStages(
      (recipe.stages || []).map((stage: any, index: number) => ({
        ...createStage(index + 1),
        ...stage,
        id: makeId(),
        stage_number: index + 1,
        instructions: stage.instructions || stage.process || '',
        ingredients: (stage.ingredients || []).map((item: any) => ({
          ...createIngredient(),
          ...item,
          id: makeId(),
        })),
      }))
    );

    setTrialNotes('');
    setRejectionReason('');
    setCorrectionPlan('');
    setShowRejectionForm(false);

    toast.success('A new draft has been prepared from the previous version.');
  };

  const updateIngredient = (
    stageId: string,
    ingredientId: string,
    field: keyof Ingredient,
    value: string | number | null
  ) => {
    setRecipeStages((previous) =>
      previous.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              ingredients: stage.ingredients.map((item) =>
                item.id === ingredientId
                  ? { ...item, [field]: value }
                  : item
              ),
            }
          : stage
      )
    );
  };

  const addIngredient = (stageId: string) => {
    setRecipeStages((previous) =>
      previous.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              ingredients: [...stage.ingredients, createIngredient()],
            }
          : stage
      )
    );
  };

  const removeIngredient = (stageId: string, ingredientId: string) => {
    setRecipeStages((previous) =>
      previous.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              ingredients: stage.ingredients.filter(
                (item) => item.id !== ingredientId
              ),
            }
          : stage
      )
    );
  };

  const addStage = () => {
    setRecipeStages((previous) => [
      ...previous,
      createStage(previous.length + 1),
    ]);
  };

  const updateStage = (
    id: string,
    field: keyof RecipeStage,
    value: string | number
  ) => {
    setRecipeStages((previous) =>
      previous.map((stage) =>
        stage.id === id ? { ...stage, [field]: value } : stage
      )
    );
  };

  const removeStage = (id: string) => {
    setRecipeStages((previous) =>
      previous
        .filter((stage) => stage.id !== id)
        .map((stage, index) => ({
          ...stage,
          stage_number: index + 1,
        }))
    );
  };

  const selectStockIngredient = (
    stageId: string,
    ingredientId: string,
    stockId: string
  ) => {
    const stock = stockItems.find((item) => item.id === stockId);
    if (!stock) return;

    updateIngredient(stageId, ingredientId, 'stock_code_id', stock.id);
    updateIngredient(stageId, ingredientId, 'stock_code', stock.stock_code);
    updateIngredient(stageId, ingredientId, 'ingredient_name', stock.description);
    updateIngredient(
      stageId,
      ingredientId,
      'unit',
      stock.unit_of_measure || 'kg'
    );
    updateIngredient(stageId, ingredientId, 'source', 'stock');
  };

  const saveVersion = async () => {
    if (!selectedId) {
      toast.error('Please save the recipe folder first.');
      return;
    }

    if (!batchSize || batchSize <= 0) {
      toast.error('Please enter a valid batch size.');
      return;
    }

    if (!recipeStages.length) {
      toast.error('Please add at least one production stage.');
      return;
    }

    if (
      recipeStages.some((stage) => !stage.stage_name.trim())
    ) {
      toast.error('Please enter a name for every production stage.');
      return;
    }

    if (
      recipeStages.some((stage) =>
        stage.ingredients.some((item) => !item.ingredient_name.trim())
      )
    ) {
      toast.error('Please complete or remove empty ingredient rows.');
      return;
    }

    try {
      setSaving(true);

      const existing = versions.find(
        (item) => item.id === selectedVersionId
      );

      const versionNumber = existing
        ? existing.version
        : nextVersionNumber;

      const savedStages = recipeStages.map((stage, index) => ({
        ...stage,
        stage_number: index + 1,
        duration_minutes: Number(stage.duration_minutes || 0),
        ingredients: stage.ingredients.map((item) => ({
          ...item,
          quantity: Number(item.quantity || 0),
          price: Number(item.price || 0),
        })),
      }));

      const flattenedIngredients = savedStages.flatMap(
        (stage) => stage.ingredients
      );

      const recipeData = {
        batch_size_kg: Number(batchSize),
        ingredients: flattenedIngredients,
        stages: savedStages,
      };

      const costingData = {
        ...(existing?.costing_data || {}),
        costing_notes: costingNotes,
      };

      const trialData = {
        ...(existing?.trial_data || {}),
        trial_notes: trialNotes,
        rejection_reason: rejectionReason,
        correction_plan: correctionPlan,
      };

      const payload = {
        parent_id: selectedId,
        record_type: 'revision',
        product_name: productName,
        product_code: selectedRecipe?.product_code || null,
        product_category: productCategory || null,
        description: description || null,
        recipe_data: recipeData,
        costing_data: costingData,
        trial_data: trialData,
        specifications_data: {},
        status: existing?.status || 'draft',
        version: versionNumber,
        is_current: true,
        change_notes: versionNote.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: currentError } = await (supabase as any)
        .from('fms_bdm_developments')
        .update({ is_current: false })
        .eq('parent_id', selectedId)
        .eq('record_type', 'revision');

      if (currentError) throw currentError;

      let savedId = selectedVersionId;

      if (selectedVersionId) {
        const { error } = await (supabase as any)
          .from('fms_bdm_developments')
          .update(payload)
          .eq('id', selectedVersionId);

        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from('fms_bdm_developments')
          .insert({
            ...payload,
            status: 'draft',
          })
          .select()
          .single();

        if (error) throw error;

        savedId = data.id;
        setSelectedVersionId(data.id);
      }

      const loaded = await loadVersions(selectedId);
      const saved = loaded.find((item) => item.id === savedId);

      if (saved) setSelectedVersionId(saved.id);

      toast.success(`Version V${versionNumber} saved.`);
   } catch (error: any) {
  console.error('VERSION SAVE ERROR DETAILS:', {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    status: error?.status,
    fullError: error,
  });

  toast.error(
    error?.message ||
    error?.details ||
    'Could not save version. Check the console for details.'
  );
} finally {
      setSaving(false);
    }
  };

  const changeStatus = async (newStatus: Status) => {
    if (!selectedVersionId) {
      toast.error('Save this version before changing its status.');
      return;
    }

    if (newStatus === 'rejected') {
      if (!rejectionReason.trim() || !correctionPlan.trim()) {
        toast.error('Both rejection fields are required.');
        setShowRejectionForm(true);
        return;
      }
    }

    try {
      setSaving(true);

      const { data: userData } = await supabase.auth.getUser();

      const oldTrial = selectedVersion?.trial_data || {};
      const history = Array.isArray(oldTrial.status_history)
        ? oldTrial.status_history
        : [];

      const historyEntry = {
        from: selectedVersion?.status || 'draft',
        to: newStatus,
        changed_at: new Date().toISOString(),
        changed_by: userData.user?.id || null,
      };

      const trialData = {
        ...oldTrial,
        trial_notes: trialNotes,
        rejection_reason: rejectionReason,
        correction_plan: correctionPlan,
        status_history: [...history, historyEntry],
      };

      const updatePayload: Record<string, any> = {
        status: newStatus,
        trial_data: trialData,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'approved') {
        updatePayload.approved_by = userData.user?.id || null;
        updatePayload.approved_at = new Date().toISOString();
      }

      if (newStatus === 'testing') {
        updatePayload.approved_by = null;
        updatePayload.approved_at = null;
      }

      const { error } = await (supabase as any)
        .from('fms_bdm_developments')
        .update(updatePayload)
        .eq('id', selectedVersionId);

      if (error) throw error;

      setShowRejectionForm(false);

      const loaded = await loadVersions(selectedId!);
      const updated = loaded.find((item) => item.id === selectedVersionId);

      if (updated) openVersion(updated);

      await loadAllApprovedVersions();

      toast.success(`Version moved to ${statusLabel(newStatus)}.`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Could not update version status.');
    } finally {
      setSaving(false);
    }
  };
  
  const updateCostingIngredient = (
    ingredientId: string,
    field: keyof Ingredient,
    value: string | number
  ) => {
    setRecipeStages((previous) =>
      previous.map((stage) => ({
        ...stage,
        ingredients: stage.ingredients.map((item) =>
          item.id === ingredientId
            ? { ...item, [field]: value }
            : item
        ),
      }))
    );
  };

  const saveCosting = async () => {
    if (!selectedVersionId || !selectedVersion) {
      toast.error('Please select an approved version.');
      return;
    }

    if (selectedVersion.status !== 'approved') {
      toast.error('Only approved versions can be costed.');
      return;
    }

    try {
      setSaving(true);

      const recipe = selectedVersion.recipe_data || {};

      const savedStages = recipeStages.map((stage) => ({
        ...stage,
        ingredients: stage.ingredients.map((item) => ({
          ...item,
          price: Number(item.price || 0),
        })),
      }));

      const savedIngredients = savedStages.flatMap(
        (stage) => stage.ingredients
      );

      const total = savedIngredients.reduce(
        (sum, item) => sum + ingredientCost(item),
        0
      );

      const costData = {
        ...(selectedVersion.costing_data || {}),
        ingredients: savedIngredients,
        ingredient_total: total,
        batch_size_kg: Number(batchSize),
        cost_per_kg: batchSize > 0 ? total / batchSize : 0,
        costing_notes: costingNotes,
        costed_at: new Date().toISOString(),
      };

      const updatedRecipe = {
        ...recipe,
        batch_size_kg: Number(batchSize),
        ingredients: savedIngredients,
        stages: savedStages,
      };

      const { error } = await (supabase as any)
        .from('fms_bdm_developments')
        .update({
          recipe_data: updatedRecipe,
          costing_data: costData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedVersionId);

      if (error) throw error;

      await loadVersions(selectedId!);
      await loadAllApprovedVersions();

      toast.success('Costing saved successfully.');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Could not save costing.');
    } finally {
      setSaving(false);
    }
  };

  const refreshAll = async () => {
    setLoading(true);

    await Promise.all([
      loadDevelopments(),
      loadStockItems(),
      loadAllApprovedVersions(),
    ]);

    if (selectedId) await loadVersions(selectedId);

    setLoading(false);
    toast.success('Data refreshed.');
  };

  const startNewRecipe = () => {
    setProductName('');
    setProductCategory('');
    setDescription('');
    setOwner('');
    setSelectedId(null);
    setVersions([]);
    clearVersionForm();
    setShowRecipeForm(true);
    setView('recipes');
  };

  const openCostingVersion = async (version: Development) => {
    const recipe = developments.find(
      (item) => item.id === version.parent_id
    );

    if (recipe) {
      setSelectedId(recipe.id);
      setProductName(recipe.product_name);
      setProductCategory(recipe.product_category || '');
      setDescription(recipe.description || '');
      setOwner(recipe.specifications_data?.owner || '');
    }

    const loaded = await loadVersions(version.parent_id!);
    const target = loaded.find((item) => item.id === version.id);

    if (target) {
      openVersion(target);
      setView('costing');
    }
  };

  const renderRecipeRow = (recipe: Development) => (
    <button
      key={recipe.id}
      onClick={() => openRecipe(recipe)}
      className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-4 text-left transition hover:bg-orange-50/50"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">
          {recipe.product_name}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {recipe.product_category || 'Uncategorised'} · Updated{' '}
          {formatDate(recipe.updated_at)}
        </p>
      </div>
      <ChevronRight size={17} className="shrink-0 text-slate-400" />
    </button>
  );

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="mr-3 h-6 w-6 animate-spin text-orange-600" />
        <span className="text-sm text-slate-500">
          Loading Product Development...
        </span>
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-[#f8f8f6]">
      <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-600">
              <Beaker size={15} />
              Business Development · Test Kitchen
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Product Development
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Develop formulations, run production trials, manage recipe versions and calculate approved product costs.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refreshAll} className="rounded-xl">
              <RefreshCw size={15} className="mr-2" />
              Refresh
            </Button>
            <Button
              onClick={startNewRecipe}
              className="rounded-xl bg-orange-600 text-white hover:bg-orange-700"
            >
              <Plus size={16} className="mr-2" />
              New Recipe
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {([
            ['overview', 'Overview', Layers],
            ['recipes', 'Recipes', Package],
            ['costing', 'Costing', Calculator],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                view === key
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-orange-50'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}

          {view === 'workspace' && (
            <button className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white">
              <FlaskConical size={16} />
              Version Workspace
            </button>
          )}
        </div>
     <div>
   </div>
        {view === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: 'Recipe folders',
                  count: developments.length,
                  icon: ClipboardList,
                  style: 'bg-slate-100 text-slate-700',
                },
                {
                  label: 'In trial',
                  count: allApprovedVersions.filter((item) => item.status === 'testing').length,
                  icon: Beaker,
                  style: 'bg-amber-100 text-amber-800',
                },
                {
                  label: 'Approved',
                  count: allApprovedVersions.length,
                  icon: CheckCircle2,
                  style: 'bg-green-100 text-green-800',
                },
                {
                  label: 'Rejected',
                  count: versions.filter((item) => item.status === 'rejected').length,
                  icon: XCircle,
                  style: 'bg-red-100 text-red-700',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">{item.label}</span>
                    <span className={`rounded-xl p-2 ${item.style}`}>
                      <item.icon size={19} />
                    </span>
                  </div>
                  <p className="mt-4 text-3xl font-bold tabular-nums text-slate-900">
                    {item.count}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 p-5">
                  <div>
                    <h2 className="font-semibold text-slate-900">Recipes on the bench</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Draft and in-trial work
                    </p>
                  </div>
                  <Beaker className="text-orange-600" size={20} />
                </div>
                {developments.length ? (
                  developments.map(renderRecipeRow)
                ) : (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No recipes have been created yet.
                  </div>
                )}
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 p-5">
                  <div>
                    <h2 className="font-semibold text-slate-900">Approved and awaiting costs</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Approved versions ready for costing
                    </p>
                  </div>
                  <Calculator className="text-green-700" size={20} />
                </div>
                <div className="p-5 text-sm text-slate-500">
                  Open the Costing section to view approved versions and enter supplier prices.
                </div>
                <div className="border-t border-slate-100 p-4">
                  <Button
                    variant="outline"
                    onClick={() => setView('costing')}
                    className="w-full rounded-xl"
                  >
                    Open Costing
                    <ChevronRight size={16} className="ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'recipes' && (
          <div className="space-y-5">
            {showRecipeForm ? (
              <div className="rounded-2xl border border-orange-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      Create a recipe
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Create the product idea first. Formulations are stored in its versions.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setShowRecipeForm(false)}
                  >
                    <XCircle size={19} />
                  </Button>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Recipe name *</Label>
                    <Input
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="e.g. Durban Curry Blend"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                      placeholder="e.g. Spice Blend"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Development brief</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what this product should achieve..."
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Recipe owner</Label>
                    <Input
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                      placeholder="Person responsible for development"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowRecipeForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={createRecipe}
                    disabled={saving}
                    className="bg-orange-600 text-white hover:bg-orange-700"
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Create recipe folder
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Recipe library</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Each recipe is a folder containing its independent versions.
                    </p>
                  </div>
                  <Button
                    onClick={startNewRecipe}
                    className="bg-orange-600 text-white hover:bg-orange-700"
                  >
                    <Plus size={16} className="mr-2" />
                    Create recipe
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search recipes..."
                    className="pl-10"
                  />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="grid grid-cols-[1fr_150px_130px] gap-3 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span>Recipe</span>
                    <span>Category</span>
                    <span className="text-right">Action</span>
                  </div>
                  {filteredDevelopments.length ? (
                    filteredDevelopments.map((recipe) => (
                      <div
                        key={recipe.id}
                        className="grid grid-cols-[1fr_150px_130px] items-center gap-3 border-b border-slate-100 px-5 py-4 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {recipe.product_name}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {recipe.description || 'No development brief added'}
                          </p>
                        </div>
                        <span className="text-sm text-slate-500">
                          {recipe.product_category || '—'}
                        </span>
                        <div className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRecipe(recipe)}
                          >
                            Open
                            <ChevronRight size={14} className="ml-1" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-10 text-center text-sm text-slate-500">
                      No matching recipes found.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {view === 'workspace' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setView('recipes')}
                >
                  <ArrowLeft size={17} />
                </Button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">
                    Recipe workspace
                  </p>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {productName || 'New recipe'}
                  </h2>
                </div>
              </div>
              <Button
                onClick={startVersion}
                disabled={!selectedId}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                <Plus size={16} className="mr-2" />
                Start a version
              </Button>
            </div>

            {!selectedId ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                <Package className="mx-auto mb-3 text-orange-600" size={32} />
                <h3 className="font-semibold text-slate-900">Create a recipe folder first</h3>
                <p className="mt-2 text-sm text-slate-500">
                  A version belongs to a recipe. Create or open a recipe before starting a formulation.
                </p>
                <Button
                  className="mt-5 bg-orange-600 text-white"
                  onClick={() => setView('recipes')}
                >
                  Go to recipes
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">Version history</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Each version retains its own formulation and trial history.
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {versions.length} saved version(s)
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {versions.map((version) => (
                        <button
                          key={version.id}
                          onClick={() => openVersion(version)}
                          className={`rounded-xl border px-3 py-2 text-left transition ${
                            selectedVersionId === version.id
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-slate-200 hover:border-orange-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-800">
                              V{version.version}
                            </span>
                            {version.is_current && (
                              <span className="text-[10px] font-semibold uppercase text-orange-600">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="mt-1">{renderStatus(version.status)}</div>
                        </button>
                      ))}
                      {versions.length === 0 && (
                        <p className="text-sm text-slate-500">
                          No versions yet. Start the first version.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">
                          Formulation
                        </p>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {selectedVersion
                            ? `Version V${selectedVersion.version}`
                            : `New version V${nextVersionNumber}`}
                        </h3>
                      </div>
                      {selectedVersion && renderStatus(selectedVersion.status)}
                    </div>

                    <div className="mb-6 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Batch size (kg) *</Label>
                        <Input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={batchSize}
                          onChange={(e) => setBatchSize(Number(e.target.value))}
                        />
                        <p className="text-xs text-slate-500">
                          Used to calculate the final cost per kg.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Version change notes</Label>
                        <Input
                          value={versionNote}
                          onChange={(e) => setVersionNote(e.target.value)}
                          placeholder="What changed in this attempt?"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-4">
                        <h4 className="font-semibold text-slate-900">Production stages</h4>
                        <p className="text-xs text-slate-500">
                          Add the ingredients and process instructions separately for each stage.
                        </p>
                      </div>

                      <div className="space-y-5">
                        {recipeStages.map((stage, index) => (
                          <div
                            key={stage.id}
                            className="rounded-xl border border-slate-200 p-4"
                          >
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-orange-600">
                                  Stage {index + 1}
                                </p>
                                <h5 className="mt-1 font-semibold text-slate-900">
                                  {stage.stage_name || `Stage ${index + 1}`}
                                </h5>
                              </div>

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeStage(stage.id)}
                                disabled={recipeStages.length === 1}
                              >
                                <Trash2 size={15} className="text-red-500" />
                              </Button>
                            </div>

                            <div className="mb-5 space-y-1.5">
                              <Label>Stage name</Label>
                              <Input
                                value={stage.stage_name}
                                onChange={(e) =>
                                  updateStage(stage.id, 'stage_name', e.target.value)
                                }
                                placeholder="e.g. WPIC001 Salt Brine"
                              />
                            </div>

                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h6 className="text-sm font-semibold text-slate-800">
                                  Stage ingredients
                                </h6>
                                <p className="text-xs text-slate-500">
                                  Select an ERP raw material or enter a manual ingredient.
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addIngredient(stage.id)}
                              >
                                <Plus size={14} className="mr-1" />
                                Add ingredient
                              </Button>
                            </div>

                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full min-w-[680px] text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                  <tr>
                                    <th className="p-3">Stock code</th>
                                    <th className="p-3">RM description</th>
                                    <th className="p-3">Quantity</th>
                                    <th className="p-3">UOM</th>
                                    <th className="p-3 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {stage.ingredients.map((item) => (
                                    <tr key={item.id} className="border-t border-slate-100">
                                      <td className="p-2">
                                        <select
                                          value={item.stock_code_id || ''}
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              selectStockIngredient(
                                                stage.id,
                                                item.id,
                                                e.target.value
                                              );
                                            } else {
                                              updateIngredient(stage.id, item.id, 'stock_code_id', null);
                                              updateIngredient(stage.id, item.id, 'stock_code', '');
                                              updateIngredient(stage.id, item.id, 'source', 'manual');
                                            }
                                          }}
                                          className="h-9 w-full min-w-[145px] rounded-md border border-input bg-background px-2 text-sm"
                                        >
                                          <option value="">Manual / select stock</option>
                                          {stockItems.map((stock) => (
                                            <option key={stock.id} value={stock.id}>
                                              {stock.stock_code}
                                            </option>
                                          ))}
                                        </select>
                                        {!item.stock_code_id && (
                                          <Input
                                            className="mt-1 h-8"
                                            value={item.stock_code}
                                            onChange={(e) =>
                                              updateIngredient(stage.id, item.id, 'stock_code', e.target.value)
                                            }
                                            placeholder="Manual code"
                                          />
                                        )}
                                      </td>
                                      <td className="p-2">
                                        <Input
                                          value={item.ingredient_name}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            const match = stockItems.find(
                                              (stock) =>
                                                stock.description.toLowerCase() ===
                                                value.trim().toLowerCase()
                                            );

                                            updateIngredient(stage.id, item.id, 'ingredient_name', value);

                                            if (match) {
                                              selectStockIngredient(stage.id, item.id, match.id);
                                            } else if (item.stock_code_id) {
                                              updateIngredient(stage.id, item.id, 'stock_code_id', null);
                                              updateIngredient(stage.id, item.id, 'stock_code', '');
                                              updateIngredient(stage.id, item.id, 'source', 'manual');
                                            }
                                          }}
                                          list={`stock-options-${stage.id}-${item.id}`}
                                          placeholder="Search or enter description"
                                        />
                                        <datalist id={`stock-options-${stage.id}-${item.id}`}>
                                          {stockItems.map((stock) => (
                                            <option key={stock.id} value={stock.description} />
                                          ))}
                                        </datalist>
                                      </td>
                                      <td className="p-2">
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.001"
                                          value={item.quantity}
                                          onChange={(e) =>
                                            updateIngredient(
                                              stage.id,
                                              item.id,
                                              'quantity',
                                              Number(e.target.value)
                                            )
                                          }
                                          className="min-w-[100px]"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <select
                                          value={item.unit}
                                          onChange={(e) =>
                                            updateIngredient(stage.id, item.id, 'unit', e.target.value)
                                          }
                                          className="h-9 w-full min-w-[75px] rounded-md border border-input bg-background px-2 text-sm"
                                        >
                                          {UNIT_OPTIONS.map((unit) => (
                                            <option key={unit} value={unit}>{unit}</option>
                                          ))}
                                        </select>
                                      </td>
                                      <td className="p-2 text-center">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => removeIngredient(stage.id, item.id)}
                                        >
                                          <Trash2 size={15} className="text-red-500" />
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                  {stage.ingredients.length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="p-5 text-center text-sm text-slate-500">
                                        No ingredients added to this stage.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            <div className="mt-5 space-y-1.5">
                              <Label>Process / Instructions</Label>
                              <Textarea
                                rows={4}
                                value={stage.instructions}
                                onChange={(e) =>
                                  updateStage(stage.id, 'instructions', e.target.value)
                                }
                                placeholder="Describe the process for this stage..."
                              />
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label>Duration (minutes)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={stage.duration_minutes}
                                  onChange={(e) =>
                                    updateStage(
                                      stage.id,
                                      'duration_minutes',
                                      Number(e.target.value)
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Temperature</Label>
                                <Input
                                  value={stage.temperature}
                                  onChange={(e) =>
                                    updateStage(stage.id, 'temperature', e.target.value)
                                  }
                                  placeholder="e.g. 80°C or Room temperature"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button
                        type="button"
                        className="mt-4 w-full"
                        variant="outline"
                        onClick={addStage}
                      >
                        <Plus size={15} className="mr-2" />
                        Add Stage {recipeStages.length + 1}
                      </Button>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={saveVersion}
                        disabled={saving}
                        className="bg-orange-600 text-white hover:bg-orange-700"
                      >
                        {saving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save size={15} className="mr-2" />
                        )}
                        Save version
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-semibold text-slate-900">Trial notes</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Record observations from making and testing this formulation.
                    </p>
                    <Textarea
                      className="mt-4"
                      rows={4}
                      value={trialNotes}
                      onChange={(e) => setTrialNotes(e.target.value)}
                      placeholder="Record trial results, taste, texture, appearance and observations..."
                    />
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        onClick={saveVersion}
                        disabled={saving || !selectedVersionId}
                      >
                        <Save size={14} className="mr-2" />
                        Save trial notes
                      </Button>
                    </div>
                  </div>
                </div>

                <aside className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <ClipboardList size={19} className="text-orange-600" />
                      <h3 className="font-semibold text-slate-900">Review</h3>
                    </div>

                    {selectedVersion ? (
                      <>
                        <div className="mb-4 rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Current status</p>
                          <div className="mt-2">{renderStatus(selectedVersion.status)}</div>
                        </div>

                        {selectedVersion.status === 'draft' && (
                          <Button
                            className="w-full bg-amber-600 text-white hover:bg-amber-700"
                            onClick={() => changeStatus('testing')}
                            disabled={saving}
                          >
                            <Beaker size={15} className="mr-2" />
                            Move to trial
                          </Button>
                        )}

                        {selectedVersion.status === 'testing' && (
                          <div className="space-y-2">
                            <Button
                              className="w-full bg-green-700 text-white hover:bg-green-800"
                              onClick={() => changeStatus('approved')}
                              disabled={saving}
                            >
                              <CheckCircle2 size={15} className="mr-2" />
                              Approve version
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full border-red-200 text-red-700 hover:bg-red-50"
                              onClick={() => setShowRejectionForm(true)}
                            >
                              <XCircle size={15} className="mr-2" />
                              Reject version
                            </Button>
                          </div>
                        )}

                        {selectedVersion.status === 'rejected' && (
                          <div className="space-y-3">
                            <Button
                              className="w-full bg-amber-600 text-white hover:bg-amber-700"
                              onClick={() => changeStatus('testing')}
                            >
                              <RefreshCw size={15} className="mr-2" />
                              Reopen for trial
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => copyVersion(selectedVersion)}
                            >
                              <Copy size={15} className="mr-2" />
                              Copy to a new version
                            </Button>
                          </div>
                        )}

                        {selectedVersion.status === 'approved' && (
                          <div className="space-y-3">
                            <p className="text-sm text-green-700">
                              This version is approved and can now be costed.
                            </p>
                            <Button
                              className="w-full"
                              onClick={() => setView('costing')}
                            >
                              <Calculator size={15} className="mr-2" />
                              Open costing
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => changeStatus('testing')}
                            >
                              Reopen for trial
                            </Button>
                          </div>
                        )}

                        {selectedVersion.status === 'rejected' && (
                          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-red-700">
                              Previous rejection
                            </p>
                            <p className="mt-3 text-xs font-semibold text-red-800">Reason</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-red-900">
                              {selectedVersion.trial_data?.rejection_reason || 'No reason recorded.'}
                            </p>
                            <p className="mt-3 text-xs font-semibold text-red-800">Correction plan</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-red-900">
                              {selectedVersion.trial_data?.correction_plan || 'No correction plan recorded.'}
                            </p>
                          </div>
                        )}

                        {showRejectionForm && (
                          <div className="mt-5 space-y-4 rounded-xl border border-red-200 bg-red-50 p-4">
                            <h4 className="font-semibold text-red-800">
                              Reject this version
                            </h4>
                            <div className="space-y-1.5">
                              <Label className="text-red-900">Why was it rejected? *</Label>
                              <Textarea
                                rows={3}
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Explain what failed..."
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-red-900">
                                What will we do differently? *
                              </Label>
                              <Textarea
                                rows={3}
                                value={correctionPlan}
                                onChange={(e) => setCorrectionPlan(e.target.value)}
                                placeholder="Describe the correction plan..."
                              />
                            </div>
                            <Button
                              className="w-full bg-red-700 text-white hover:bg-red-800"
                              onClick={() => changeStatus('rejected')}
                              disabled={saving || !rejectionReason.trim() || !correctionPlan.trim()}
                            >
                              Confirm rejection
                            </Button>
                            <Button
                              variant="ghost"
                              className="w-full"
                              onClick={() => setShowRejectionForm(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}

                        <div className="mt-5 border-t border-slate-100 pt-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Review history
                          </p>
                          {(selectedVersion.trial_data?.status_history || []).length ? (
                            [...selectedVersion.trial_data.status_history]
                              .reverse()
                              .map((entry: any, index: number) => (
                                <div key={index} className="border-l-2 border-orange-200 py-2 pl-3">
                                  <p className="text-xs font-semibold text-slate-800">
                                    {statusLabel(entry.from)} → {statusLabel(entry.to)}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {formatDate(entry.changed_at)}
                                  </p>
                                </div>
                              ))
                          ) : (
                            <p className="text-xs text-slate-500">
                              No status changes recorded yet.
                            </p>
                          )}
                        </div>

                        {selectedVersion.approved_at && (
                          <div className="mt-3 rounded-lg bg-green-50 p-3 text-xs text-green-800">
                            Approved on {formatDate(selectedVersion.approved_at)}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                        Save a version before using the review controls.
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-semibold text-slate-900">Recipe information</h3>
                    <div className="mt-4 space-y-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">Category</p>
                        <p className="font-medium text-slate-800">
                          {productCategory || 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Owner</p>
                        <p className="font-medium text-slate-800">
                          {owner || 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Versions created</p>
                        <p className="font-medium text-slate-800">{versions.length}</p>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </div>
        )}

        {view === 'costing' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Approved version costing</h2>
              <p className="mt-1 text-sm text-slate-500">
                Only approved formulations can be costed. Enter supplier prices for each ingredient.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-4">
                  <h3 className="font-semibold text-slate-900">Approved versions</h3>
                </div>

                {allApprovedVersions.map((version) => {
                  const recipe = developments.find(
                    (item) => item.id === version.parent_id
                  );

                  if (!recipe) return null;

                  return (
                    <button
                      key={version.id}
                      onClick={() => openCostingVersion(version)}
                      className={`w-full border-b border-slate-100 p-4 text-left hover:bg-green-50 ${
                        selectedVersionId === version.id ? 'bg-green-50' : ''
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-800">
                        {recipe.product_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Version V{version.version}
                      </p>
                      <span className="mt-2 inline-flex rounded-full bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-800">
                        Approved
                      </span>
                    </button>
                  );
                })}

                {!allApprovedVersions.length && (
                  <p className="p-4 text-sm text-slate-500">
                    No approved versions are available yet.
                  </p>
                )}
              </div>

              <div className="space-y-5">
                {selectedVersion && selectedVersion.status === 'approved' ? (
                  <>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                            Approved formulation
                          </p>
                          <h3 className="mt-1 text-xl font-semibold text-slate-900">
                            {productName} · V{selectedVersion.version}
                          </h3>
                        </div>
                        {renderStatus(selectedVersion.status)}
                      </div>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Batch size (kg)</Label>
                          <Input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={batchSize}
                            onChange={(e) => setBatchSize(Number(e.target.value))}
                          />
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Total batch cost</p>
                          <p className="mt-1 text-xl font-bold text-slate-900">
                            {CURRENCY.format(totalIngredientCost)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-100 p-5">
                        <h3 className="font-semibold text-slate-900">
                          <FileSpreadsheet size={17} className="mr-2 inline text-orange-600" />
                          Ingredient costing sheet
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Ingredients remain grouped under their production stages.
                        </p>
                      </div>

                      <div className="space-y-6 p-5">
                        {recipeStages.map((stage, index) => (
                          <div key={stage.id}>
                            <h4 className="mb-3 font-semibold text-slate-800">
                              Stage {index + 1}: {stage.stage_name}
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[800px] text-sm">
                                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                                  <tr>
                                    <th className="p-3">Ingredient</th>
                                    <th className="p-3">Quantity</th>
                                    <th className="p-3">Price</th>
                                    <th className="p-3">Price quoted per</th>
                                    <th className="p-3">Supplier</th>
                                    <th className="p-3 text-right">Line cost</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {stage.ingredients.map((item) => (
                                    <tr key={item.id} className="border-t border-slate-100">
                                      <td className="p-3">
                                        <p className="font-medium text-slate-800">
                                          {item.ingredient_name}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {item.stock_code || 'Manual ingredient'}
                                        </p>
                                      </td>
                                      <td className="p-3">
                                        {item.quantity} {item.unit}
                                      </td>
                                      <td className="p-3">
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={item.price}
                                          onChange={(e) =>
                                            updateCostingIngredient(
                                              item.id,
                                              'price',
                                              Number(e.target.value)
                                            )
                                          }
                                          className="w-28"
                                        />
                                      </td>
                                      <td className="p-3">
                                        <select
                                          value={item.price_unit}
                                          onChange={(e) =>
                                            updateCostingIngredient(
                                              item.id,
                                              'price_unit',
                                              e.target.value
                                            )
                                          }
                                          className="h-9 rounded-md border border-input bg-background px-2"
                                        >
                                          {UNIT_OPTIONS.map((unit) => (
                                            <option key={unit} value={unit}>{unit}</option>
                                          ))}
                                        </select>
                                      </td>
                                      <td className="p-3">
                                        <Input
                                          value={item.supplier}
                                          onChange={(e) =>
                                            updateCostingIngredient(
                                              item.id,
                                              'supplier',
                                              e.target.value
                                            )
                                          }
                                          placeholder="Supplier"
                                          className="w-36"
                                        />
                                      </td>
                                      <td className="p-3 text-right font-semibold tabular-nums">
                                        {CURRENCY.format(ingredientCost(item))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4 border-t border-slate-100 p-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs text-slate-500">Total batch cost</p>
                            <p className="mt-1 text-2xl font-bold text-slate-900">
                              {CURRENCY.format(totalIngredientCost)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-orange-50 p-4">
                            <p className="text-xs text-orange-700">Cost per kg</p>
                            <p className="mt-1 text-2xl font-bold text-orange-800">
                              {CURRENCY.format(costPerKg)}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Costing notes</Label>
                          <Textarea
                            rows={3}
                            value={costingNotes}
                            onChange={(e) => setCostingNotes(e.target.value)}
                            placeholder="Supplier quotations, costing assumptions or notes..."
                          />
                        </div>

                        <div className="flex justify-end">
                          <Button
                            onClick={saveCosting}
                            disabled={saving}
                            className="bg-orange-600 text-white hover:bg-orange-700"
                          >
                            {saving ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Save size={15} className="mr-2" />
                            )}
                            Save costing
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                    <Calculator className="mx-auto mb-3 text-orange-600" size={32} />
                    <h3 className="font-semibold text-slate-900">
                      Select an approved version
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Choose an approved formulation from the list to open its costing sheet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default BDMProductDevelopment;
