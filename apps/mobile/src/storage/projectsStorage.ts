import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project, PROJECT_STORAGE_KEY } from '@/src/features/projects/types';

/**
 * Load all projects from AsyncStorage.
 * Normalizes all project IDs to strings.
 */
export async function loadProjects(): Promise<Project[]> {
  try {
    const saved = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
    if (!saved) return [];
    
    const parsed: Project[] = JSON.parse(saved);
    // Normalize IDs to strings
    return parsed.map((p) => ({ ...p, id: String(p.id) }));
  } catch (error) {
    console.warn('[projectsStorage] Failed to load projects', error);
    return [];
  }
}

/**
 * Save all projects to AsyncStorage.
 */
export async function saveProjects(projects: Project[]): Promise<void> {
  try {
    // Normalize IDs before saving. schemaVersion stemples her («mangler = 1»)
    // så fremtidige formendringer kan gjøres som migrering-ved-lesing.
    const normalized = projects.map((p) => ({
      ...p,
      id: String(p.id),
      schemaVersion: p.schemaVersion ?? 1,
    }));
    await AsyncStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(normalized));
  } catch (error) {
    console.warn('[projectsStorage] Failed to save projects', error);
    throw error;
  }
}

/**
 * Get a single project by ID.
 */
export async function getProject(id: string): Promise<Project | null> {
  const projects = await loadProjects();
  const normalizedId = String(id);
  return projects.find((p) => String(p.id) === normalizedId) ?? null;
}

/**
 * Update a single project in storage.
 * If project doesn't exist, it will be added.
 */
export async function updateProject(project: Project): Promise<Project[]> {
  const projects = await loadProjects();
  const normalizedId = String(project.id);
  const normalizedProject = { ...project, id: normalizedId };
  
  const exists = projects.some((p) => String(p.id) === normalizedId);
  const nextProjects = exists
    ? projects.map((p) => String(p.id) === normalizedId ? normalizedProject : p)
    : [...projects, normalizedProject];
  
  await saveProjects(nextProjects);
  return nextProjects;
}

/**
 * Delete a project from storage.
 */
export async function deleteProject(id: string): Promise<Project[]> {
  const projects = await loadProjects();
  const normalizedId = String(id);
  const nextProjects = projects.filter((p) => String(p.id) !== normalizedId);
  await saveProjects(nextProjects);
  return nextProjects;
}
