import React from 'react';

function LoadingSkeleton({ type = 'card', count = 1 }) {
  const elements = Array(count).fill(0);

  if (type === 'card') {
    return (
      <div className="space-y-4 w-full">
        {elements.map((_, i) => (
          <div key={i} className="animate-pulse bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-4">
            <div className="w-12 h-12 bg-slate-200 rounded-full flex-shrink-0"></div>
            <div className="flex-1 space-y-3 py-1">
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-slate-200 rounded w-full"></div>
                <div className="h-3 bg-slate-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'profile') {
    return (
      <div className="animate-pulse bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8">
          <div className="flex items-start gap-8 mb-8 border-b border-slate-100 pb-8">
            <div className="w-24 h-24 bg-slate-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-10 bg-slate-200 rounded"></div>
                <div className="h-10 bg-slate-200 rounded"></div>
                <div className="h-10 bg-slate-200 rounded"></div>
                <div className="h-10 bg-slate-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="space-y-3 w-full">
        {elements.map((_, i) => (
          <div key={i} className="animate-pulse bg-white p-4 rounded-lg border border-slate-100 flex items-center gap-4">
            <div className="w-2 h-12 bg-slate-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-full"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export default LoadingSkeleton;
