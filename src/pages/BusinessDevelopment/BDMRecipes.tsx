
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  BookOpen,
  Search,
  Eye,
  RefreshCw,
  Package,
  CalendarDays,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface RecipeIngredient {
  id?: string;
  stock_code?: string;
  stock_code_id?: string | null;
  ingredient_name?: string;
  quantity?: number | string;
  unit?: string;
  uom?: string;
}

interface RecipeStage {
  id?: string;
  stage_number?: number;
  stage_name?: string;
  process?: string;
  instructions?: string;
  ingredients?: RecipeIngredient[];
}

interface RecipeData {
  batch_size_kg?: number | string;
  ingredients?: RecipeIngredient[];
  stages?: RecipeStage[];
}

interface Recipe {
  id: string;
  parent_id: string | null;
  record_type: 'master' | 'revision';
  product_name: string;
  product_code: string | null;
  product_category: string | null;
  description: string | null;
  version: number;
  status: string;
  is_current: boolean;
  recipe_data: RecipeData | null;
  costing_data: Record<string, any> | null;
  trial_data: Record<string, any> | null;
  specifications_data: Record<string, any> | null;
  approved_by: string | null;
  approved_at: string | null;
  updated_at: string;
  created_at?: string;
}

const BDMRecipes = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showRecipeDetails, setShowRecipeDetails] = useState(false);

  const loadRecipes = async () => {
    try {
      setLoading(true);

      const { data, error } = await (supabase as any)
        .from('fms_bdm_developments')
        .select('*')
        .eq('record_type', 'revision')
        .eq('status', 'approved')
        .order('approved_at', { ascending: false, nullsFirst: false })
        .order('version', { ascending: false });

      if (error) throw error;

      const approvedRecipes = (data || []) as Recipe[];

      // Keep only the latest approved version for each product.
      const latestByProduct = new Map<string, Recipe>();

      approvedRecipes.forEach((recipe) => {
        const productKey = recipe.parent_id || recipe.id;
        const existing = latestByProduct.get(productKey);

        if (!existing) {
          latestByProduct.set(productKey, recipe);
          return;
        }

        const recipeDate = new Date(
          recipe.approved_at || recipe.updated_at || recipe.created_at || 0
        ).getTime();

        const existingDate = new Date(
          existing.approved_at || existing.updated_at || existing.created_at || 0
        ).getTime();

        if (
          recipe.version > existing.version ||
          (recipe.version === existing.version && recipeDate > existingDate)
        ) {
          latestByProduct.set(productKey, recipe);
        }
      });

      setRecipes(
        Array.from(latestByProduct.values()).sort((a, b) =>
          a.product_name.localeCompare(b.product_name)
        )
      );
    } catch (error: any) {
      console.error('Recipe loading error:', error);
      toast.error('Could not load approved recipes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  const filteredRecipes = useMemo(() => {
    const searchTerm = search.toLowerCase().trim();

    if (!searchTerm) return recipes;

    return recipes.filter((recipe) =>
      `${recipe.product_name} ${recipe.product_code || ''} ${
        recipe.product_category || ''
      }`
        .toLowerCase()
        .includes(searchTerm)
    );
  }, [recipes, search]);

  const openRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShowRecipeDetails(true);
  };

  const getStages = (recipe: Recipe): RecipeStage[] => {
    return Array.isArray(recipe.recipe_data?.stages)
      ? recipe.recipe_data!.stages!
      : [];
  };

  const getIngredients = (stage: RecipeStage): RecipeIngredient[] => {
    return Array.isArray(stage.ingredients) ? stage.ingredients : [];
  };

  const getQuantity = (ingredient: RecipeIngredient) => {
    const quantity = Number(ingredient.quantity);

    return Number.isFinite(quantity)
      ? quantity.toLocaleString('en-ZA', {
          maximumFractionDigits: 4,
        })
      : '—';
  };

  const getUnit = (ingredient: RecipeIngredient) => {
    return ingredient.unit || ingredient.uom || '—';
  };

  const getStageProcess = (stage: RecipeStage) => {
    return stage.process || stage.instructions || '';
  };

  const getAllIngredients = (recipe: Recipe) => {
    const stages = getStages(recipe);

    // New formulation layout: ingredients belong to individual stages.
    const stageIngredients = stages.flatMap((stage) =>
      getIngredients(stage)
    );

    if (stageIngredients.length > 0) {
      return stageIngredients;
    }

    // Older formulation layout: ingredients were stored at recipe level.
    return Array.isArray(recipe.recipe_data?.ingredients)
      ? recipe.recipe_data!.ingredients!
      : [];
  };

  return (
    <section className="space-y-6 p-4 md:p-6">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="text-orange-500" size={25} />

            <h1 className="text-2xl font-bold text-gray-900">
              Recipe Management
            </h1>
          </div>

          <p className="mt-1 text-sm text-gray-500">
            View approved product formulations from Product Development.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={loadRecipes}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw
            size={16}
            className={loading ? 'animate-spin' : ''}
          />
          Refresh
        </Button>
      </div>

      {/* SUMMARY */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <BookOpen size={17} />
            <p className="text-sm">Approved Recipes</p>
          </div>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {recipes.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <Layers size={17} />
            <p className="text-sm">Manufacturing Formulations</p>
          </div>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {recipes.filter(
              (recipe) => getStages(recipe).length > 0
            ).length}
          </p>
        </div>
      </div>

      {/* RECIPE LIBRARY */}
      <div className="rounded-xl border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              Approved Recipe Library
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Recipes are automatically published here after approval in Product Development.
            </p>
          </div>

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
                <th className="p-3">Batch Size</th>
                <th className="p-3">Approval Date</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-gray-500"
                  >
                    Loading approved recipes...
                  </td>
                </tr>
              ) : filteredRecipes.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-10 text-center"
                  >
                    <Package
                      size={32}
                      className="mx-auto mb-3 text-gray-300"
                    />

                    <p className="font-medium text-gray-700">
                      No approved recipes found.
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Approved formulations from Product Development will appear here automatically.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecipes.map((recipe) => (
                  <tr
                    key={recipe.id}
                    className="border-t hover:bg-orange-50/40"
                  >
                    <td className="p-3 font-medium text-gray-900">
                      {recipe.product_name}
                    </td>

                    <td className="p-3">
                      {recipe.product_code || '—'}
                    </td>

                    <td className="p-3">
                      {recipe.product_category || '—'}
                    </td>

                    <td className="p-3">
                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                        v{recipe.version}
                      </span>
                    </td>

                    <td className="p-3">
                      {recipe.recipe_data?.batch_size_kg
                        ? `${recipe.recipe_data.batch_size_kg} kg`
                        : '—'}
                    </td>

                    <td className="p-3">
                      {recipe.approved_at
                        ? new Date(
                            recipe.approved_at
                          ).toLocaleDateString('en-ZA')
                        : '—'}
                    </td>

                    <td className="p-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRecipe(recipe)}
                        className="gap-2"
                      >
                        <Eye size={15} />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t px-4 py-3 text-xs text-gray-500">
          Showing {filteredRecipes.length} of {recipes.length} approved recipes.
        </div>
      </div>

      {/* RECIPE DETAILS */}
      <Dialog
        open={showRecipeDetails}
        onOpenChange={(open) => {
          setShowRecipeDetails(open);

          if (!open) {
            setSelectedRecipe(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {selectedRecipe?.product_name || 'Recipe Details'}
            </DialogTitle>

            <DialogDescription>
              Approved Product Formulation
              {selectedRecipe?.version
                ? ` — Version ${selectedRecipe.version}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedRecipe && (
            <div className="space-y-6">
              {/* PRODUCT INFORMATION */}
              <div className="rounded-xl border bg-gray-50 p-4">
                <h3 className="mb-4 font-semibold text-gray-900">
                  Product Information
                </h3>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs text-gray-500">
                      Product Code
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedRecipe.product_code || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Category
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedRecipe.product_category || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Version
                    </p>
                    <p className="mt-1 font-medium">
                      v{selectedRecipe.version}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Batch Size
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedRecipe.recipe_data?.batch_size_kg
                        ? `${selectedRecipe.recipe_data.batch_size_kg} kg`
                        : 'Not specified'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Approval Date
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedRecipe.approved_at
                        ? new Date(
                            selectedRecipe.approved_at
                          ).toLocaleDateString('en-ZA')
                        : 'Not available'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Status
                    </p>
                    <p className="mt-1 font-medium capitalize text-green-700">
                      {selectedRecipe.status}
                    </p>
                  </div>
                </div>

                {selectedRecipe.description && (
                  <div className="mt-4 border-t pt-4">
                    <p className="text-xs text-gray-500">
                      Product Description
                    </p>

                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {selectedRecipe.description}
                    </p>
                  </div>
                )}
              </div>

              {/* MANUFACTURING STAGES */}
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Manufacturing Formulation
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Ingredients and process instructions are displayed under the stage where they are used.
                  </p>
                </div>

                {getStages(selectedRecipe).length > 0 ? (
                  getStages(selectedRecipe).map((stage, index) => (
                    <div
                      key={stage.id || index}
                      className="overflow-hidden rounded-xl border"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-orange-50 px-4 py-3">
                        <h4 className="font-semibold text-orange-800">
                          Stage {stage.stage_number || index + 1}:{' '}
                          {stage.stage_name || 'Untitled Stage'}
                        </h4>

                        <span className="text-xs text-gray-500">
                          {getIngredients(stage).length} ingredients
                        </span>
                      </div>

                      {/* STAGE INGREDIENTS */}
                      <div className="p-4">
                        <h5 className="mb-3 text-sm font-semibold text-gray-800">
                          Ingredients
                        </h5>

                        <div className="overflow-x-auto rounded-lg border">
                          <table className="w-full min-w-[550px] text-sm">
                            <thead className="bg-gray-50">
                              <tr className="text-left text-gray-600">
                                <th className="p-3">Stock Code</th>
                                <th className="p-3">RM Description</th>
                                <th className="p-3">Quantity</th>
                                <th className="p-3">UOM</th>
                              </tr>
                            </thead>

                            <tbody>
                              {getIngredients(stage).length > 0 ? (
                                getIngredients(stage).map(
                                  (ingredient, ingredientIndex) => (
                                    <tr
                                      key={ingredient.id || ingredientIndex}
                                      className="border-t"
                                    >
                                      <td className="p-3">
                                        {ingredient.stock_code || '—'}
                                      </td>

                                      <td className="p-3 font-medium">
                                        {ingredient.ingredient_name ||
                                          'Unnamed ingredient'}
                                      </td>

                                      <td className="p-3">
                                        {getQuantity(ingredient)}
                                      </td>

                                      <td className="p-3">
                                        {getUnit(ingredient)}
                                      </td>
                                    </tr>
                                  )
                                )
                              ) : (
                                <tr>
                                  <td
                                    colSpan={4}
                                    className="p-4 text-center text-gray-500"
                                  >
                                    No ingredients recorded for this stage.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* STAGE PROCESS */}
                      <div className="border-t bg-gray-50 p-4">
                        <h5 className="mb-2 text-sm font-semibold text-gray-800">
                          Process Instructions
                        </h5>

                        <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {getStageProcess(stage) ||
                            'No process instructions recorded.'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
                    No manufacturing stages have been recorded for this recipe.
                  </div>
                )}
              </div>

              {/* LEGACY INGREDIENT FALLBACK */}
              {getStages(selectedRecipe).length === 0 &&
                getAllIngredients(selectedRecipe).length > 0 && (
                  <div>
                    <h3 className="mb-3 font-semibold">
                      Recipe Ingredients
                    </h3>

                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr className="text-left">
                            <th className="p-3">Stock Code</th>
                            <th className="p-3">RM Description</th>
                            <th className="p-3">Quantity</th>
                            <th className="p-3">UOM</th>
                          </tr>
                        </thead>

                        <tbody>
                          {getAllIngredients(selectedRecipe).map(
                            (ingredient, index) => (
                              <tr
                                key={ingredient.id || index}
                                className="border-t"
                              >
                                <td className="p-3">
                                  {ingredient.stock_code || '—'}
                                </td>
                                <td className="p-3">
                                  {ingredient.ingredient_name || '—'}
                                </td>
                                <td className="p-3">
                                  {getQuantity(ingredient)}
                                </td>
                                <td className="p-3">
                                  {getUnit(ingredient)}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default BDMRecipes;
