import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * Rubric configuration / editing panel with score-level editor.
 *
 * Props:
 *  - rubricType        {string}
 *  - setRubricType     {function}
 *  - rubricCourseId    {string}
 *  - setRubricCourseId {function}
 *  - rubricSessionId   {string}
 *  - setRubricSessionId{function}
 *  - rubricLoading     {boolean}
 *  - rubricLevels      {Array}
 *  - updateRubricLevel {function(score, field, value)}
 *  - saveRubric        {function}
 *  - rubricSaving      {boolean}
 *  - rubricMsg         {string}
 */
export default function RubricEditor({
  rubricType,
  setRubricType,
  rubricCourseId,
  setRubricCourseId,
  rubricSessionId,
  setRubricSessionId,
  rubricLoading,
  rubricLevels,
  updateRubricLevel,
  saveRubric,
  rubricSaving,
  rubricMsg,
}) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-4">Rubric Configuration</h2>
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Rubric Type</label>
          <select
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            value={rubricType}
            onChange={(e) => setRubricType(e.target.value)}
          >
            <option value="file_review">File Review</option>
            <option value="peer_technical">Peer - Technical</option>
            <option value="peer_interactions">Peer - Interactions</option>
            <option value="peer_management">Peer - Management</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Course (optional)</label>
          <input
            type="text"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            placeholder="e.g. CSE2100"
            value={rubricCourseId}
            onChange={(e) => setRubricCourseId(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Session UUID (optional)</label>
          <input
            type="text"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm min-w-[320px]"
            placeholder="peer review session id"
            value={rubricSessionId}
            onChange={(e) => setRubricSessionId(e.target.value)}
          />
        </div>
      </div>

      {rubricLoading ? (
        <p className="text-sm text-slate-500">Loading rubric...</p>
      ) : (
        <div className="space-y-3">
          {rubricLevels.map((lvl) => (
            <div key={lvl.score} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="text-xs font-semibold text-slate-500 mb-2">Score {lvl.score}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                  value={lvl.label}
                  onChange={(e) => updateRubricLevel(lvl.score, 'label', e.target.value)}
                  placeholder="Label"
                />
                <input
                  type="text"
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                  value={lvl.desc}
                  onChange={(e) => updateRubricLevel(lvl.score, 'desc', e.target.value)}
                  placeholder="Description"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={saveRubric} disabled={rubricSaving || rubricLoading}>
          {rubricSaving ? 'Saving...' : 'Save Rubric'}
        </Button>
        {rubricMsg && <span className="text-sm text-slate-600">{rubricMsg}</span>}
      </div>
    </Card>
  );
}
