import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from './SettingsPanel';
import type { Settings } from '../../types/git';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockSaveSettings, mockSetState, mockStartAutoFetch } = vi.hoisted(() => ({
  mockSaveSettings: vi.fn(),
  mockSetState: vi.fn(),
  mockStartAutoFetch: vi.fn(),
}));

vi.mock('../../services/gitService', () => ({
  gitService: { saveSettings: mockSaveSettings },
}));

vi.mock('../../store/gitStore', () => {
  const useGitStore = Object.assign(vi.fn(), { setState: mockSetState });
  return { useGitStore, startAutoFetch: mockStartAutoFetch };
});

const { useGitStore } = await import('../../store/gitStore');
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

function setupStore(overrides: Partial<{ settings: Settings; settingsTab: string }> = {}) {
  const state = { settings: defaultSettings, settingsTab: 'general', ...overrides };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseGitStore.mockImplementation((selector: any) => selector(state));
}

function renderPanel() {
  return render(<SettingsPanel />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetState.mockReset();
    mockSaveSettings.mockResolvedValue(defaultSettings);
    setupStore();
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  describe('initial render', () => {
    it('renders without crashing', () => {
      renderPanel();
      // "General" appears in both sidebar button and header — check header specifically
      expect(screen.getByRole('heading', { level: 2, name: 'General' })).toBeInTheDocument();
    });

    it('renders all four sidebar tabs', () => {
      renderPanel();
      expect(screen.getByRole('button', { name: /general/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /git/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ai/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /about/i })).toBeInTheDocument();
    });

    it('returns null when settings is undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockUseGitStore.mockImplementation((selector: any) =>
        selector({ settings: undefined, settingsTab: 'general' }),
      );
      const { container } = renderPanel();
      expect(container.firstChild).toBeNull();
    });

    it('shows Save Settings and Cancel buttons on non-about tabs', () => {
      renderPanel();
      expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  // ── General tab ────────────────────────────────────────────────────────────

  describe('General tab', () => {
    it('shows auto-fetch interval select defaulting to Disabled', () => {
      renderPanel();
      expect(screen.getByDisplayValue('Disabled')).toBeInTheDocument();
    });

    it('shows all auto-fetch interval options', () => {
      renderPanel();
      const expected = ['Disabled', '30 seconds', '1 minute', '5 minutes', '10 minutes', '30 minutes'];
      for (const label of expected) {
        expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
      }
    });

    it('shows update channel defaulting to Stable', () => {
      renderPanel();
      expect(screen.getByDisplayValue('Stable')).toBeInTheDocument();
    });

    it('shows alpha option in update channel select', () => {
      renderPanel();
      expect(screen.getByRole('option', { name: 'Alpha (early access)' })).toBeInTheDocument();
    });

    it('shows default target branch input with current value', () => {
      renderPanel();
      expect(screen.getByPlaceholderText('main')).toHaveValue('main');
    });

    it('reflects non-default settings values', () => {
      setupStore({
        settings: { ...defaultSettings, autoFetchInterval: 300, updateChannel: 'alpha', defaultTargetBranch: 'master' },
      });
      renderPanel();
      expect(screen.getByDisplayValue('5 minutes')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Alpha (early access)')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('main')).toHaveValue('master');
    });
  });

  // ── Git tab ────────────────────────────────────────────────────────────────

  describe('Git tab', () => {
    it('shows git path input with current value', () => {
      setupStore({ settingsTab: 'git' });
      renderPanel();
      expect(screen.getByPlaceholderText('git')).toHaveValue('git');
    });

    it('shows custom git path when configured', () => {
      setupStore({ settingsTab: 'git', settings: { ...defaultSettings, gitPath: '/usr/local/bin/git' } });
      renderPanel();
      expect(screen.getByPlaceholderText('git')).toHaveValue('/usr/local/bin/git');
    });
  });

  // ── AI tab ─────────────────────────────────────────────────────────────────

  describe('AI tab', () => {
    beforeEach(() => setupStore({ settingsTab: 'ai' }));

    it('shows provider select with current provider', () => {
      renderPanel();
      expect(screen.getByDisplayValue('ollama')).toBeInTheDocument();
    });

    it('lists all AI providers', () => {
      renderPanel();
      for (const p of ['ollama', 'openai', 'anthropic', 'groq']) {
        expect(screen.getByRole('option', { name: p })).toBeInTheDocument();
      }
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

    it('shows model placeholder when model is empty', () => {
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
      expect(screen.getByText('Visual Git Client')).toBeInTheDocument();
    });

    it('shows version string after getVersion resolves', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByText(/v0\.1\.0-alpha/i)).toBeInTheDocument();
      });
    });

    it('does not show Save Settings or Cancel buttons', () => {
      renderPanel();
      expect(screen.queryByRole('button', { name: 'Save Settings' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });

    it('shows built-with text', () => {
      renderPanel();
      expect(screen.getByText(/tauri/i)).toBeInTheDocument();
    });
  });

  // ── Field interactions (dispatch to store) ────────────────────────────────

  describe('field editing dispatches to store', () => {
    it('auto-fetch interval change calls useGitStore.setState with new value', async () => {
      const user = userEvent.setup();
      renderPanel();
      const select = screen.getByDisplayValue('Disabled');
      await user.selectOptions(select, '60');
      expect(mockSetState).toHaveBeenCalledWith({
        settings: expect.objectContaining({ autoFetchInterval: 60 }),
      });
    });

    it('update channel change calls useGitStore.setState', async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.selectOptions(screen.getByDisplayValue('Stable'), 'alpha');
      expect(mockSetState).toHaveBeenCalledWith({
        settings: expect.objectContaining({ updateChannel: 'alpha' }),
      });
    });

    it('default target branch input calls useGitStore.setState', () => {
      renderPanel();
      fireEvent.change(screen.getByPlaceholderText('main'), { target: { value: 'develop' } });
      expect(mockSetState).toHaveBeenCalledWith({
        settings: expect.objectContaining({ defaultTargetBranch: 'develop' }),
      });
    });

    it('git path input calls useGitStore.setState', () => {
      setupStore({ settingsTab: 'git' });
      renderPanel();
      fireEvent.change(screen.getByPlaceholderText('git'), { target: { value: '/usr/bin/git' } });
      expect(mockSetState).toHaveBeenCalledWith({
        settings: expect.objectContaining({ gitPath: '/usr/bin/git' }),
      });
    });

    it('AI provider change calls useGitStore.setState', async () => {
      const user = userEvent.setup();
      setupStore({ settingsTab: 'ai' });
      renderPanel();
      await user.selectOptions(screen.getByDisplayValue('ollama'), 'openai');
      expect(mockSetState).toHaveBeenCalledWith({
        settings: expect.objectContaining({ aiProvider: 'openai' }),
      });
    });

    it('AI model input calls useGitStore.setState', () => {
      setupStore({ settingsTab: 'ai' });
      renderPanel();
      fireEvent.change(screen.getByDisplayValue('llama3'), { target: { value: 'gpt-4o' } });
      expect(mockSetState).toHaveBeenCalledWith({
        settings: expect.objectContaining({ aiModel: 'gpt-4o' }),
      });
    });
  });

  // ── Save ───────────────────────────────────────────────────────────────────

  describe('save', () => {
    it('calls gitService.saveSettings with current store settings', async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole('button', { name: 'Save Settings' }));
      await waitFor(() => expect(mockSaveSettings).toHaveBeenCalledWith(defaultSettings));
    });

    it('shows Saving… while save is in progress', async () => {
      mockSaveSettings.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(defaultSettings), 200)),
      );
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole('button', { name: 'Save Settings' }));
      expect(screen.getByText('Saving…')).toBeInTheDocument();
    });

    it('Save button is disabled while saving', async () => {
      mockSaveSettings.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(defaultSettings), 200)),
      );
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole('button', { name: 'Save Settings' }));
      expect(screen.getByText('Saving…').closest('button')).toBeDisabled();
    });

    it('calls startAutoFetch with saved interval after successful save', async () => {
      const savedSettings = { ...defaultSettings, autoFetchInterval: 300 };
      mockSaveSettings.mockResolvedValue(savedSettings);
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole('button', { name: 'Save Settings' }));
      await waitFor(() => expect(mockStartAutoFetch).toHaveBeenCalledWith(300));
    });

    it('closes panel (settingsOpen: false) after successful save', async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole('button', { name: 'Save Settings' }));
      await waitFor(() =>
        expect(mockSetState).toHaveBeenCalledWith(
          expect.objectContaining({ settingsOpen: false }),
        ),
      );
    });

    it('stores saved settings back into store after save', async () => {
      const savedSettings = { ...defaultSettings, gitPath: '/usr/bin/git' };
      mockSaveSettings.mockResolvedValue(savedSettings);
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole('button', { name: 'Save Settings' }));
      await waitFor(() =>
        expect(mockSetState).toHaveBeenCalledWith(
          expect.objectContaining({ settings: savedSettings }),
        ),
      );
    });
  });

  // ── Cancel ─────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('sets settingsOpen to false', async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockSetState).toHaveBeenCalledWith({ settingsOpen: false });
    });

    it('does not call saveSettings', async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockSaveSettings).not.toHaveBeenCalled();
    });
  });

  // ── Close (X) button ───────────────────────────────────────────────────────

  describe('close (X) button in header', () => {
    it('sets settingsOpen to false', async () => {
      const user = userEvent.setup();
      renderPanel();
      // X button is in the header, alongside the tab title
      const header = screen.getByRole('heading', { level: 2 });
      const xBtn = header.closest('div')!.querySelector('button')!;
      await user.click(xBtn);
      expect(mockSetState).toHaveBeenCalledWith({ settingsOpen: false });
    });
  });

  // ── Auto-fetch option values ───────────────────────────────────────────────

  describe('auto-fetch option values', () => {
    it('Disabled option has value 0', () => {
      renderPanel();
      expect((screen.getByRole('option', { name: 'Disabled' }) as HTMLOptionElement).value).toBe('0');
    });

    it('30 seconds option has value 30', () => {
      renderPanel();
      expect((screen.getByRole('option', { name: '30 seconds' }) as HTMLOptionElement).value).toBe('30');
    });

    it('1 minute option has value 60', () => {
      renderPanel();
      expect((screen.getByRole('option', { name: '1 minute' }) as HTMLOptionElement).value).toBe('60');
    });

    it('30 minutes option has value 1800', () => {
      renderPanel();
      expect((screen.getByRole('option', { name: '30 minutes' }) as HTMLOptionElement).value).toBe('1800');
    });
  });
});
