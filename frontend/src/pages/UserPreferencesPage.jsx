import { useState, useEffect } from 'react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/ToastProvider';
import { Settings, Sun, Moon, Type, Eye, Save } from 'lucide-react';

const FONT_SIZES = [
  { value: 'small', label: 'Small', class: 'text-sm' },
  { value: 'medium', label: 'Medium', class: 'text-base' },
  { value: 'large', label: 'Large', class: 'text-lg' },
];

export default function UserPreferencesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState({ theme: 'light', font_size: 'medium', high_contrast: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    API.get('/preferences')
      .then(r => { if (r.data) setPrefs(prev => ({ ...prev, ...r.data })); })
      .catch(() => { showToast('Failed to load preferences', 'error'); })
      .finally(() => setLoading(false));
  }, []);

  // Apply preferences to the actual page DOM
  const applyPrefs = (p) => {
    // Theme
    if (p.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', p.theme);

    // Font size — set CSS variable on root
    const sizeMap = { small: '14px', medium: '16px', large: '18px' };
    document.documentElement.style.fontSize = sizeMap[p.font_size] || '16px';
    localStorage.setItem('fontSize', p.font_size);

    // High contrast
    if (p.high_contrast) document.documentElement.classList.add('high-contrast');
    else document.documentElement.classList.remove('high-contrast');
    localStorage.setItem('highContrast', String(p.high_contrast));
  };

  // Apply on initial load
  useEffect(() => {
    if (!loading) applyPrefs(prefs);
  }, [loading]);

  const save = (overridePrefs) => {
    const toSave = overridePrefs || prefs;
    setSaving(true);
    API.patch('/preferences', toSave)
      .then(() => {
        showToast('Preferences saved', 'success');
        applyPrefs(toSave);
      })
      .catch(() => showToast('Failed to save preferences', 'error'))
      .finally(() => setSaving(false));
  };

  // Auto-save when any toggle changes
  const updateAndSave = (updater) => {
    setPrefs(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      // Save in next tick after state update
      setTimeout(() => save(next), 0);
      return next;
    });
  };

  if (loading) return <div className="max-w-2xl mx-auto p-6"><div className="animate-pulse h-64 bg-slate-100 rounded-2xl" /></div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-[#000E2F]" />
        <h1 className="text-2xl font-bold text-[#000E2F]">Preferences</h1>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {prefs.theme === 'light' ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} className="text-indigo-500" />}
            <div>
              <h3 className="font-medium text-slate-900">Theme</h3>
              <p className="text-sm text-slate-500">Choose light or dark mode</p>
            </div>
          </div>
          <button
            onClick={() => updateAndSave(p => ({ ...p, theme: p.theme === 'light' ? 'dark' : 'light' }))}
            className={`relative w-14 h-7 rounded-full transition-colors ${prefs.theme === 'dark' ? 'bg-[#000E2F]' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${prefs.theme === 'dark' ? 'translate-x-7' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <div className="flex items-center gap-3 mb-3">
            <Type size={20} className="text-slate-600" />
            <div>
              <h3 className="font-medium text-slate-900">Font Size</h3>
              <p className="text-sm text-slate-500">Adjust text size across the application</p>
            </div>
          </div>
          <div className="flex gap-2">
            {FONT_SIZES.map(fs => (
              <button
                key={fs.value}
                onClick={() => updateAndSave(p => ({ ...p, font_size: fs.value }))}
                className={`flex-1 py-2 rounded-lg text-center font-medium transition-colors ${fs.class} ${
                  prefs.font_size === fs.value
                    ? 'bg-[#000E2F] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {fs.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye size={20} className="text-slate-600" />
              <div>
                <h3 className="font-medium text-slate-900">High Contrast</h3>
                <p className="text-sm text-slate-500">Increase contrast for better readability</p>
              </div>
            </div>
            <button
              onClick={() => updateAndSave(p => ({ ...p, high_contrast: !p.high_contrast }))}
              className={`relative w-14 h-7 rounded-full transition-colors ${prefs.high_contrast ? 'bg-[#000E2F]' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${prefs.high_contrast ? 'translate-x-7' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save size={16} className="mr-2" /> {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
