
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import BDMLayout from './BDMLayout';
import {
  BookOpen,
  Plus,
  Search,
  Eye,
  Pencil,
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

const BDMRecipes = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
          onClick={() => toast.info('Recipe creation will be added next.')}
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
    </section>
  );
};

export default BDMRecipes;
