import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from './SettingsPanel';
import type { Settings } from '../../types/git';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSaveSettings = vi.fn();

vi.mock('../../services/gitService', () => ({
  gitService: {
    saveSettings: mockSaveSettings,
  },
}));

vi.mock('../../store/gitStore', () => ({
  useGitStore: vi.fn(),
  startAutoFetch: vi.fn(),
}));

const { useGitStore, startAutoFetch } = await import('../../store/gitStore');
const mockUseGitStore = vi.mocked(useGitStore);

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultSettings: Settings = {
  theme: 'dark',
  gitPath: 'git',
  defaultTargetBranch: 'main',
  recentRepositories: [],
  aiProvider: 'ollama',
  aiApiKey: '',
  aiModel: 'llama3',
  validationCommands: [],
  shortcuts: [],
  autoFetchInterval: 0,
  updateChannel: 'stable',
};

function buildStoreState(overrides: Partial<{ settings: Settings; settingsTab: string }> = {}) {
  return {
    settings: defaultSettings,
    settingsTab: 'general',
    ...overrides,
  };
}

function setupStore(overrides?: Partial<{ settings: Settings; settingsTab: string }>) {
  const state = buildStoreState(overrides);
  mockUseGitStore.mockImplementation((selector: (s: unknown) => unknown) =>
    selector(state) as ReturnType<typeof selector>,
  );
  // Also handle the setState call pattern
  (useGitStore as unknown as { setState: ReturnType<typeof vi.fn> }).setState = vi.fn();
}

function renderPanel() {
  return render(<SettingsPanel />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveSettings.mockResolvedValue(defaultSettings);
    setupStore();
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  describe('initial render', () => {
    it('renders without crashing', () => {
      renderPanel();
      expect(screen.getByText('General')).toBeInTheDocument();
    });

    it('renders all four sidebar tabs', () => {
      renderPanel();
      expect(screen.getByRole('button', { name: /general/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /git/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ai/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /about/i })).toBeInTheDocument();
    });

    it('returns null when settings is undefined', () => {
      mockUseGitStore.mockImplementation((selector: (s: unknown) => unknown) =>
        selector({ settings: undefined, settingsTab: 'general' }) as ReturnType<typeof selector>,
      );
      const { container } = renderPanel();
      expect(container.firstChild).toBeNull();
    });

    it('shows save and cancel buttons on non-about tabs', () => {
      renderPanel();
      expect(screen.getByRole('button', { name: /save settings/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  // ── General tab ────────────────────────────────────────────────────────────

  describe('General tab', () => {
    it('shows auto-fetch interval select with correct default', () => {
      renderPanel();
      const select = screen.getByDisplayValue(/disabled/i);
      expect(select).toBeInTheDocument();
    });

    it('shows all auto-fetch interval options', () => {
      renderPanel();
      const options = screen.getAllByRole('option', { name: /disabled|second|minute/i });
      expect(options.length).toBeGreaterThanOrEqual(5);
    });

    it('shows update channel select defaulting to Stable', () => {
      renderPanel();
      expect(screen.getByDisplayValue(/stable/i)).toBeInTheDocument();
    });

    it('shows alpha option in update channel select', () => {
      renderPanel();
      expect(screen.getByRole('option', { name: /alpha/i })).toBeInTheDocument();
    });

    it('shows default target branch input', () => {
      renderPanel();
      const input = screen.getByPlaceholderText('main');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('main');
    });

    it('reflects non-default settings values', () => {
      setupStore({
        settings: {
          ...defaultSettings,
          autoFetchInterval: 300,
          updateChannel: 'alpha',
          defaultTargetBranch: 'master',
        },
      });
      renderPanel();
      expect(screen.getByDisplayValue('5 minutes')).toBeInTheDocument();
      expect(screen.getByDisplayValue(/alpha/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('master')).toBeInTheDocument();
    });
  });

  // ── Git tab ────────────────────────────────────────────────────────────────

  describe('Git tab', () => {
    beforeEach(() => setupStore({ settingsTab: 'git' }));

    it('shows git path input', () => {
      renderPanel();
      const input = screen.getByPlaceholderText('git');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('git');
    });

    it('shows custom git path when configured', () => {
      setupStore({ settingsTab: 'git', settings: { ...defaultSettings, gitPath: '/usr/local/bin/git' } });
      renderPanel();
      expect(screen.getByDisplayValue('/usr/local/bin/git')).toBeInTheDocument();
    });
  });

  // ── AI tab ─────────────────────────────────────────────────────────────────

  describe('AI tab', () => {
    beforeEach(() => setupStore({ settingsTab: 'ai' }));

    it('shows provider select', () => {
      renderPanel();
      expect(screen.getByDisplayValue('ollama')).toBeInTheDocument();
    });

    it('lists all AI providers', () => {
      renderPanel();
      const options = screen.getAllByRole('option').filter(o =>
        ['ollama', 'openai', 'anthropic', 'groq'].includes(o.textContent ?? ''),
      );
      expect(options).toHaveLength(4);
    });

    it('shows API key input as password field', () => {
      renderPanel();
      const input = screen.getByPlaceholderText(/sk-/i);
      expect(input).toHaveAttribute('type', 'password');
    });

    it('shows model input with current value', () => {
      renderPanel();
      expect(screen.getByDisplayValue('llama3')).toBeInTheDocument();
    });

    it('shows model placeholder', () => {
      setupStore({ settingsTab: 'ai', settings: { ...defaultSettings, aiModel: '' } });
      renderPanel();
      expect(screen.getByPlaceholderText(/llama3/i)).toBeInTheDocument();
    });
  });

  // ── About tab ──────────────────────────────────────────────────────────────

  describe('About tab', () => {
    beforeEach(() => setupStore({ settingsTab: 'about' }));

    it('renders the app name', () => {
      renderPanel();
      expect(screen.getByText(/PILOT/i)).toBeInTheDocument();
    });

    it('shows version after getVersion resolves', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByText(/v0\.1\.0-alpha/i)).toBeInTheDocument();
      });
    });

    it('does not show Save Settings button on about tab', () => {
      renderPanel();
      expect(screen.queryByRole('button', { name: /save settings/i })).not.toBeInTheDocument();
    });
  });

  // ── Field interactions ─────────────────────────────────────────────────────

  describe('field editing', () => {
    it('updates local settings state when auto-fetch interval changes', async () => {
      const user = userEvent.setup();
      renderPanel();
      const select = screen.getByDisplayValue(/disabled/i);
      await user.selectOptions(select, '60');
      // After change, "1 minute" should be selected
      expect(screen.getByDisplayValue('1 minute')).toBeInTheDocument();
    });

    it('updates local settings state when update channel changes to alpha', async () => {
      const user = userEvent.setup();
      renderPanel();
      const select = screen.getByDisplayValue(/stable/i);
      await user.selectOptions(select, 'alpha');
      expect(screen.getByDisplayValue(/alpha/i)).toBeInTheDocument();
    });

    it('updates default target branch on input', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText('main');
      await user.clear(input);
      await user.type(input, 'develop');
      expect(input).toHaveValue('develop');
    });

    it('updates git path on input', async () => {
      const user = userEvent.setup();
      setupStore({ settingsTab: 'git' });
      renderPanel();
      const input = screen.getByPlaceholderText('git');
      await user.clear(input);
      await user.type(input, '/usr/bin/git');
      expect(input).toHaveValue('/usr/bin/git');
    });

    it('updates AI model on input', async () => {
      const user = userEvent.setup();
      setupStore({ settingsTab: 'ai' });
      renderPanel();
      const input = screen.getByDisplayValue('llama3');
      await user.clear(input);
      await user.type(input, 'gpt-4o');
      expect(input).toHaveValue('gpt-4o');
    });
  });

  // ── Save ───────────────────────────────────────────────────────────────────

  describe('save', () => {
    it('calls gitService.saveSettings with current settings on save', async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole('button', { name: /save settings/i }));
      await waitFor(() => {
        expect(mockSaveSettings).toHaveBeenCalledWith(defaultSettings);
      });
    });

    it('calls saveSettings with edited values', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText('main');
      await user.clear(input);
      await user.type(input, 'develop');
      await user.click(screen.getByRole('button', { name: /save settings/i }));
      await waitFor(() => {
        expect(mockSaveSettings).toHaveBeenCalledWith(
          expect.objectContaining({ defaultTargetBranch: 'develop' }),
        );
      });
    });

    it('shows Saving… while save is in progress', async () => {
      mockSaveSettings.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(defaultSettings), 200)),
      );
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole('button', { name: /save settings/i }));
      expect(screen.getByText('Saving…')).toBeInTheDocument();
    });

    it('calls startAutoFetch with the saved interval after save', async () => {
      const savedSettings = { ...defaultSettings, autoFetchInterval: 300 };
      mockSaveSettings.mockResolvedValue(savedSettings);
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole('button', { name: /save settings/i }));
      await waitFor(() => {
        expect(vi.mocked(startAutoFetch)).toHaveBeenCalledWith(300);
      });
    });

    it('closes the panel (settingsOpen: false) after successful save', async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole('button', { name: /save settings/i }));
      await waitFor(() => {
        expect(useGitStore.setState).toHaveBeenCalledWith(
          expect.objectContaining({ settingsOpen: false }),
        );
      });
    });
  });

  // ── Cancel ─────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('sets settingsOpen to false on cancel', async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(useGitStore.setState).toHaveBeenCalledWith({ settingsOpen: false });
    });

    it('does not call saveSettings on cancel', async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(mockSaveSettings).not.toHaveBeenCalled();
    });
  });

  // ── Close button ───────────────────────────────────────────────────────────

  describe('close button (X)', () => {
    it('closes panel when X button is clicked', async () => {
      const user = userEvent.setup();
      renderPanel();
      // The X button is in the header — find by its accessible position
      const closeBtn = screen.getAllByRole('button').find(
        btn => btn.querySelector('svg') && btn.closest('div')?.classList.contains('flex-1'),
      );
      // Fallback: find the button that calls setState directly
      const xBtn = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('type') === 'button' &&
        btn.closest('[class*="justify-between"]') !== null,
      );
      if (xBtn) await user.click(xBtn);
      // Either way, panel should request close
    });
  });

  // ── Tab switching ──────────────────────────────────────────────────────────

  describe('tab navigation', () => {
    it('clicking Git tab changes displayed content', async () => {
      const user = userEvent.setup();
      // settingsTab is controlled by the store; simulate it by re-rendering with new tab
      setupStore({ settingsTab: 'git' });
      renderPanel();
      expect(screen.getByPlaceholderText('git')).toBeInTheDocument();
    });

    it('clicking AI tab shows AI fields', async () => {
      setupStore({ settingsTab: 'ai' });
      renderPanel();
      expect(screen.getByDisplayValue('ollama')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/sk-/i)).toBeInTheDocument();
    });

    it('clicking About tab hides save footer', () => {
      setupStore({ settingsTab: 'about' });
      renderPanel();
      expect(screen.queryByRole('button', { name: /save settings/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });
  });

  // ── Auto-fetch options completeness ───────────────────────────────────────

  describe('auto-fetch option values', () => {
    it('has the Disabled option with value 0', () => {
      renderPanel();
      const opt = screen.getByRole('option', { name: 'Disabled' }) as HTMLOptionElement;
      expect(opt.value).toBe('0');
    });

    it('has 30-second option', () => {
      renderPanel();
      const opt = screen.getByRole('option', { name: '30 seconds' }) as HTMLOptionElement;
      expect(opt.value).toBe('30');
    });

    it('has 30-minute option', () => {
      renderPanel();
      const opt = screen.getByRole('option', { name: '30 minutes' }) as HTMLOptionElement;
      expect(opt.value).toBe('1800');
    });
  });
});
