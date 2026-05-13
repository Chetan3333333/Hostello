import { Search } from 'lucide-react';
import { useState, useMemo } from 'react';

export default function DataTable({ columns, data, searchable = true, searchPlaceholder = 'Search...', onRowClick, emptyMessage = 'No data found', pageSize = 10 }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const filtered = useMemo(() => {
    let result = data;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(row =>
        columns.some(col => {
          const val = col.accessor ? row[col.accessor] : '';
          return String(val).toLowerCase().includes(q);
        })
      );
    }
    if (sortCol) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortCol] ?? '';
        const bVal = b[sortCol] ?? '';
        if (typeof aVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
      });
    }
    return result;
  }, [data, search, sortCol, sortDir, columns]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageData = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (accessor) => {
    if (!accessor) return;
    if (sortCol === accessor) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(accessor);
      setSortDir('asc');
    }
  };

  return (
    <div className="data-table-wrapper">
      {searchable && (
        <div className="data-table-search">
          <Search size={16} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="form-input"
          />
        </div>
      )}
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  onClick={() => col.sortable !== false && handleSort(col.accessor)}
                  className={col.sortable !== false ? 'sortable' : ''}
                >
                  {col.header}
                  {sortCol === col.accessor && (
                    <span className="sort-icon">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr><td colSpan={columns.length} className="data-table-empty">{emptyMessage}</td></tr>
            ) : (
              pageData.map((row, rIdx) => (
                <tr
                  key={row.id || rIdx}
                  onClick={() => onRowClick?.(row)}
                  className={onRowClick ? 'clickable' : ''}
                >
                  {columns.map((col, cIdx) => (
                    <td key={cIdx}>
                      {col.render ? col.render(row) : (col.accessor ? row[col.accessor] : '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="data-table-pagination">
          <span className="data-table-info">
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="data-table-pages">
            <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
              return (
                <button key={pageNum} className={`btn btn-ghost btn-sm ${page === pageNum ? 'active' : ''}`} onClick={() => setPage(pageNum)}>
                  {pageNum + 1}
                </button>
              );
            })}
            <button className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
