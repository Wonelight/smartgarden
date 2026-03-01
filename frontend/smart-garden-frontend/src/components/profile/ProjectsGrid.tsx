import React from 'react';
import { Plus } from 'lucide-react';

export interface ProjectCard {
    id: string;
    title: string;
    subtitle: string;
    imageAlt?: string;
    onViewAll?: () => void;
}

interface ProjectsGridProps {
    projects: ProjectCard[];
    onCreateNew?: () => void;
}

export const ProjectsGrid: React.FC<ProjectsGridProps> = ({ projects, onCreateNew }) => {
    return (
        <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Dự án</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                    <div
                        key={project.id}
                        id={project.id}
                        className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
                    >
                        <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
                            {project.imageAlt ?? project.title}
                        </div>
                        <div className="p-4">
                            <h4 className="font-medium text-slate-900">{project.title}</h4>
                            <p className="text-sm text-slate-500 mt-0.5">{project.subtitle}</p>
                            {project.onViewAll && (
                                <button
                                    type="button"
                                    className="btn-view-all mt-3 text-xs font-semibold uppercase tracking-wider text-teal-600 hover:text-teal-700"
                                    onClick={project.onViewAll}
                                >
                                    VIEW ALL
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {onCreateNew && (
                    <button
                        type="button"
                        role="button"
                        className="card-new-project flex flex-col items-center justify-center min-h-[140px] rounded-xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50/50 transition-colors"
                        onClick={onCreateNew}
                    >
                        <Plus className="w-8 h-8 mb-2" />
                        <span className="text-sm font-medium">Tạo dự án mới</span>
                    </button>
                )}
            </div>
        </div>
    );
};
