import { db } from '../schema';
import type { Category } from '../../../types';

export class CategoryRepository {
  async getById(categoryId: string): Promise<Category | undefined> {
    return await db.categories.get(categoryId);
  }

  async getAll(): Promise<Category[]> {
    return await db.categories.toArray();
  }

  async create(category: Category): Promise<string> {
    await db.categories.put(category);
    return category.categoryId;
  }

  async update(categoryId: string, updates: Partial<Category>): Promise<void> {
    await db.categories.update(categoryId, {
      ...updates,
      updatedAt: new Date()
    });
  }

  async delete(categoryId: string): Promise<void> {
    // Don't delete if it's the only category
    const count = await db.categories.count();
    if (count <= 1) {
      throw new Error('Cannot delete the last category');
    }

    // Move transcripts to uncategorized before deleting
    const uncategorized = await db.categories
      .filter(c => c.name === 'Uncategorized')
      .first();
    
    if (uncategorized) {
      await db.transcripts
        .where('categoryId')
        .equals(categoryId)
        .modify({ categoryId: uncategorized.categoryId });
    }

    await db.categories.delete(categoryId);
  }

  async getByName(name: string): Promise<Category | undefined> {
    return await db.categories
      .where('name')
      .equals(name)
      .first();
  }

  async getOrCreateUncategorized(): Promise<Category> {
    let uncategorized = await this.getByName('Uncategorized');
    if (!uncategorized) {
      const now = new Date();
      const id = `default-uncategorized-${Date.now()}`;
      uncategorized = {
        categoryId: id,
        name: 'Uncategorized',
        colorToken: 'gray',
        createdAt: now,
        updatedAt: now
      };
      await this.create(uncategorized);
    }
    return uncategorized;
  }

  async getStats(): Promise<Array<Category & { count: number }>> {
    const categories = await this.getAll();
    const stats = await Promise.all(
      categories.map(async (cat) => {
        const count = await db.transcripts
          .where('categoryId')
          .equals(cat.categoryId)
          .count();
        return { ...cat, count };
      })
    );
    return stats;
  }
}

export const categoryRepository = new CategoryRepository();
