
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

import {
  BookOpen,
  Plus,
  Search,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface Recipe {
  id: string;
  product_name: string;
  product_code: string | null;
  product_category: string | null;
  version: number;
  status: string;
  recipe_data: any[];
  updated_at: string;
}

interface RecipeIngredient {
  id: string;
  stock_code: string;
  ingredient_name: string;
  quantity: string;
  uom: string;
  notes: string;
}

interface RecipeStage {
  id: string;
  stage_name: string;
  process: string;
  ingredients: RecipeIngredient[];
}

const createRecipeIngredient = (): RecipeIngredient => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  stock_code: '',
  ingredient_name: '',
  quantity: '',
  uom: 'kg',
  notes: '',
});

const createRecipeStage = (number: number): RecipeStage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  stage_name: `Stage ${number}`,
  process: '',
  ingredients: [createRecipeIngredient()],
});

const getStageTotals = (ingredients: RecipeIngredient[]) => {
  const totals = {
    kg: 0,
    L: 0,
    '%': 0,
    units: 0,
  };

  ingredients.forEach((item) => {
    const quantity = Number(item.quantity) || 0;

    switch (item.uom) {
      case 'kg':
        totals.kg += quantity;
        break;
      case 'g':
        totals.kg += quantity / 1000;
        break;
      case 'L':
        totals.L += quantity;
        break;
      case 'ml':
        totals.L += quantity / 1000;
        break;
      case '%':
        totals['%'] += quantity;
        break;
      case 'Units':
      case 'Pieces':
        totals.units += quantity;
        break;
    }
  });

  return totals;
};


const BDMRecipes = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  
const [showAddRecipe, setShowAddRecipe] = useState(false);
const [saving, setSaving] = useState(false);

const [recipeName, setRecipeName] = useState('');
const [productCode, setProductCode] = useState('');
const [category, setCategory] = useState('');
const [description, setDescription] = useState('');
const [preparationStage, setPreparationStage] = useState('');

const [recipeStages, setRecipeStages] = useState<RecipeStage[]>([
  createRecipeStage(1),
]);

const loadRecipes = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('fms_bdm_developments')
        .select('*')
        .eq('record_type', 'recipe')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setRecipes((data || []) as Recipe[]);
    } catch (error: any) {
      console.error(error);
      toast.error('Could not load recipes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, []);


const resetRecipeForm = () => {
  setRecipeName('');
  setProductCode('');
  setCategory('');
  setDescription('');
  setPreparationStage('');
  setRecipeStages([createRecipeStage(1)]);
};

const saveRecipe = async (
  recipeStatus: 'draft' | 'pending_approval'
) => {
  if (!recipeName.trim()) {
    toast.error('Please enter a recipe name.');
    return;
  }

  if (recipeStages.length === 0) {
    toast.error('Please add at least one manufacturing stage.');
    return;
  }

  for (const stage of recipeStages) {
    if (!stage.stage_name.trim()) {
      toast.error('Please enter a name for every stage.');
      return;
    }

    if (stage.ingredients.length === 0) {
      toast.error(`Please add ingredients to ${stage.stage_name}.`);
      return;
    }

    const invalidIngredient = stage.ingredients.some(
      (item) =>
        !item.ingredient_name.trim() ||
        !item.quantity ||
        Number(item.quantity) <= 0 ||
        !item.uom
    );

    if (invalidIngredient) {
      toast.error(`Please complete the ingredients in ${stage.stage_name}.`);
      return;
    }
  }

  try {
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();

    const recipeData = recipeStages.map((stage, index) => ({
      stage_number: index + 1,
      stage_name: stage.stage_name,
      process: stage.process,
      ingredients: stage.ingredients.map((item) => ({
        stock_code: item.stock_code.trim(),
        ingredient_name: item.ingredient_name.trim(),
        quantity: Number(item.quantity),
        uom: item.uom,
        notes: item.notes.trim(),
      })),
    }));

    const { error } = await supabase
      .from('fms_bdm_developments')
      .insert({
        product_name: recipeName.trim(),
        product_code: productCode.trim() || null,
        product_category: category || null,
        description: description.trim() || null,
        record_type: 'recipe',
        version: 1,
        is_current: true,
        recipe_data: recipeData,
        specifications_data: {
          preparation_stage: preparationStage.trim(),
        },
        costing_data: {},
        trial_data: [],
        status: recipeStatus,
        created_by: userData.user?.id || null,
      });

    if (error) throw error;

    toast.success('Recipe saved successfully!');

    resetRecipeForm();
    setShowAddRecipe(false);
    await loadRecipes();
  } catch (error: any) {
    console.error('Recipe save error:', error);
    toast.error(error.message || 'Could not save recipe.');
  } finally {
    setSaving(false);
  }
};



const addStage = () => {
  setRecipeStages((current) => [
    ...current,
    createRecipeStage(current.length + 1),
  ]);
};

const removeStage = (stageId: string) => {
  setRecipeStages((current) =>
    current
      .filter((stage) => stage.id !== stageId)
      .map((stage, index) => ({
        ...stage,
        stage_name: `Stage ${index + 1}`,
      }))
  );
};

const updateStage = (
  stageId: string,
  field: 'stage_name' | 'process',
  value: string
) => {
  setRecipeStages((current) =>
    current.map((stage) =>
      stage.id === stageId
        ? { ...stage, [field]: value }
        : stage
    )
  );
};

const addStageIngredient = (stageId: string) => {
  setRecipeStages((current) =>
    current.map((stage) =>
      stage.id === stageId
        ? {
            ...stage,
            ingredients: [
              ...stage.ingredients,
              createRecipeIngredient(),
            ],
          }
        : stage
    )
  );
};

const updateStageIngredient = (
  stageId: string,
  ingredientId: string,
  field: keyof RecipeIngredient,
  value: string
) => {
  setRecipeStages((current) =>
    current.map((stage) =>
      stage.id === stageId
        ? {
            ...stage,
            ingredients: stage.ingredients.map((ingredient) =>
              ingredient.id === ingredientId
                ? { ...ingredient, [field]: value }
                : ingredient
            ),
          }
        : stage
    )
  );
};

const removeStageIngredient = (
  stageId: string,
  ingredientId: string
) => {
  setRecipeStages((current) =>
    current.map((stage) =>
      stage.id === stageId
        ? {
            ...stage,
            ingredients: stage.ingredients.filter(
              (ingredient) => ingredient.id !== ingredientId
            ),
          }
        : stage
    )
  );
};


  const filteredRecipes = recipes.filter((recipe) =>
    `${recipe.product_name} ${recipe.product_code || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <section className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="text-orange-500" size={25} />
            <h1 className="text-2xl font-bold text-gray-900">
              Recipe Management
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Manage approved product recipes and formulations.
          </p>
        </div>

        <button
          onClick={() => setShowAddRecipe(true)}
          className="flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600"
        >
          <Plus size={17} />
          Add Recipe
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-500">Total Recipes</p>
          <p className="mt-1 text-2xl font-bold">{recipes.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-500">Approved Recipes</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {recipes.filter((r) => r.status === 'approved').length}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-gray-900">Recipe Library</h2>

          <div className="relative w-full sm:max-w-xs">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipes..."
              className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:border-orange-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-orange-50 text-left text-gray-700">
                <th className="p-3">Recipe Name</th>
                <th className="p-3">Product Code</th>
                <th className="p-3">Category</th>
                <th className="p-3">Version</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Loading recipes...
                  </td>
                </tr>
              ) : filteredRecipes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No recipes found.
                  </td>
                </tr>
              ) : (
                filteredRecipes.map((recipe) => (
                  <tr key={recipe.id} className="border-t hover:bg-orange-50/40">
                    <td className="p-3 font-medium">{recipe.product_name}</td>
                    <td className="p-3">{recipe.product_code || '—'}</td>
                    <td className="p-3">{recipe.product_category || '—'}</td>
                    <td className="p-3">v{recipe.version}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                        {recipe.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => toast.info('Recipe details coming next.')}
                        className="rounded-lg border p-2 text-gray-600 hover:border-orange-400 hover:text-orange-600"
                        title="View recipe"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t p-3">
          <button
            onClick={loadRecipes}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>
      
{showAddRecipe && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6">
    <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">

      <div className="flex items-center justify-between border-b p-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Create New Recipe
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Enter product details, ingredients and preparation instructions.
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setShowAddRecipe(false);
            resetRecipeForm();
          }}
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">

        <div>
          <h3 className="mb-3 font-semibold">Product Information</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm">Recipe Name *</label>
              <input
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                placeholder="Recipe name"
                className="w-full rounded-lg border p-2.5"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">Product Code</label>
              <input
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                placeholder="Product code"
                className="w-full rounded-lg border p-2.5"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border p-2.5"
              >
                <option value="">Select category</option>
                <option value="Seasoning">Seasoning</option>
                <option value="Spice Blend">Spice Blend</option>
                <option value="Sauce">Sauce</option>
                <option value="Marinade">Marinade</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description"
                className="w-full rounded-lg border p-2.5"
              />
            </div>
          </div>
        </div>

        
{/* PREPARATION STAGE */}
<div>
  <h3 className="mb-3 font-semibold">
    Preparation Stage
  </h3>

  <textarea
    value={preparationStage}
    onChange={(e) => setPreparationStage(e.target.value)}
    rows={4}
    placeholder="Enter the initial preparation instructions..."
    className="w-full rounded-lg border p-3"
  />
</div>

{/* MANUFACTURING STAGES */}
<div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h3 className="font-semibold">Manufacturing Stages</h3>
      <p className="text-sm text-gray-500">
        Add ingredients and process instructions for each stage.
      </p>
    </div>

    <button
      type="button"
      onClick={addStage}
      className="rounded-lg bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700"
    >
      + Add Stage
    </button>
  </div>

  {recipeStages.map((stage, stageIndex) => {
    const totals = getStageTotals(stage.ingredients);

    return (
      <div
        key={stage.id}
        className="space-y-4 rounded-xl border p-4"
      >
        {/* STAGE HEADING */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="font-semibold text-orange-700">
            Stage {stageIndex + 1}
          </h4>

          <button
            type="button"
            disabled={recipeStages.length === 1}
            onClick={() => removeStage(stage.id)}
            className="text-sm text-red-500 disabled:opacity-30"
          >
            Remove Stage
          </button>
        </div>

        {/* STAGE NAME */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            Stage Description *
          </label>

          <input
            value={stage.stage_name}
            onChange={(e) =>
              updateStage(stage.id, 'stage_name', e.target.value)
            }
            placeholder="e.g. Salt Brine"
            className="w-full rounded-lg border p-2.5"
          />
        </div>

        {/* INGREDIENTS */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h5 className="text-sm font-semibold">
              Ingredients
            </h5>

            <button
              type="button"
              onClick={() => addStageIngredient(stage.id)}
              className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-700"
            >
              + Add Ingredient
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="bg-orange-50">
                <tr className="text-left">
                  <th className="p-3">Stock Code</th>
                  <th className="p-3">RM Description</th>
                  <th className="p-3">Quantity</th>
                  <th className="p-3">UOM</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {stage.ingredients.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-2">
                      <input
                        value={item.stock_code}
                        onChange={(e) =>
                          updateStageIngredient(
                            stage.id,
                            item.id,
                            'stock_code',
                            e.target.value
                          )
                        }
                        placeholder="RM001"
                        className="w-28 rounded border p-2"
                      />
                    </td>

                    <td className="p-2">
                      <input
                        value={item.ingredient_name}
                        onChange={(e) =>
                          updateStageIngredient(
                            stage.id,
                            item.id,
                            'ingredient_name',
                            e.target.value
                          )
                        }
                        placeholder="Ingredient description"
                        className="w-full rounded border p-2"
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.quantity}
                        onChange={(e) =>
                          updateStageIngredient(
                            stage.id,
                            item.id,
                            'quantity',
                            e.target.value
                          )
                        }
                        placeholder="0"
                        className="w-24 rounded border p-2"
                      />
                    </td>

                    <td className="p-2">
                      <select
                        value={item.uom}
                        onChange={(e) =>
                          updateStageIngredient(
                            stage.id,
                            item.id,
                            'uom',
                            e.target.value
                          )
                        }
                        className="w-24 rounded border p-2"
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="L">L</option>
                        <option value="ml">ml</option>
                        <option value="%">%</option>
                        <option value="Units">Units</option>
                        <option value="Pieces">Pieces</option>
                      </select>
                    </td>

                    <td className="p-2">
                      <input
                        value={item.notes}
                        onChange={(e) =>
                          updateStageIngredient(
                            stage.id,
                            item.id,
                            'notes',
                            e.target.value
                          )
                        }
                        placeholder="Optional"
                        className="w-full rounded border p-2"
                      />
                    </td>

                    <td className="p-2">
                      <button
                        type="button"
                        disabled={stage.ingredients.length === 1}
                        onClick={() =>
                          removeStageIngredient(stage.id, item.id)
                        }
                        className="rounded p-2 text-red-500 disabled:opacity-30"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AUTOMATIC TOTALS */}
          <div className="mt-3 flex flex-wrap gap-3 rounded-lg bg-gray-50 p-3 text-sm">
            <span className="font-semibold">Stage Totals:</span>

            {totals.kg > 0 && (
              <span>{totals.kg.toFixed(3)} kg</span>
            )}

            {totals.L > 0 && (
              <span>{totals.L.toFixed(3)} L</span>
            )}

            {totals['%'] > 0 && (
              <span
                className={
                  Math.abs(totals['%'] - 100) < 0.001
                    ? 'font-semibold text-green-700'
                    : 'font-semibold text-orange-700'
                }
              >
                {totals['%'].toFixed(3)}%
                {Math.abs(totals['%'] - 100) < 0.001
                  ? ' (100% complete)'
                  : ' (Target: 100%)'}
              </span>
            )}

            {totals.units > 0 && (
              <span>{totals.units.toLocaleString()} Units / Pieces</span>
            )}

            {!Object.values(totals).some((value) => value > 0) && (
              <span className="text-gray-500">No quantities entered yet.</span>
            )}
          </div>
        </div>

        {/* PROCESS */}
        <div>
          <label className="mb-2 block text-sm font-semibold">
            Process Instructions
          </label>

          <textarea
            value={stage.process}
            onChange={(e) =>
              updateStage(stage.id, 'process', e.target.value)
            }
            rows={4}
            placeholder="Describe the process for this manufacturing stage..."
            className="w-full rounded-lg border p-3"
          />
        </div>
      </div>
    );
  })}

  <button
    type="button"
    onClick={addStage}
    className="w-full rounded-lg border border-dashed border-orange-400 py-3 text-sm font-medium text-orange-700 hover:bg-orange-50"
  >
    + Add Another Manufacturing Stage
  </button>
</div>


        

        <div className="rounded-lg bg-orange-50 p-4 text-sm text-gray-600">
          New recipes start at version 1. You can save a draft or submit it for approval.
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t bg-gray-50 p-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setShowAddRecipe(false);
            resetRecipeForm();
          }}
          className="rounded-lg border bg-white px-4 py-2.5 text-sm"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => saveRecipe('draft')}
          className="rounded-lg border border-orange-500 px-4 py-2.5 text-sm text-orange-600"
        >
          {saving ? 'Saving...' : 'Save as Draft'}
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => saveRecipe('pending_approval')}
          className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm text-white"
        >
          {saving ? 'Saving...' : 'Submit for Approval'}
        </button>
      </div>
    </div>
  </div>
)}

    </section>
  );
};

export default BDMRecipes;
