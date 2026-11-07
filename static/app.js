/**
 * Freedom Broker CQA - High-Density Enterprise Financial CRM
 * Supports full Dark (default) and Light themes, authentic Chess Ratings,
 * 3-Column Persistent Side-by-Side Workspace, clean rounded scores (no fractional clutter),
 * and keyboard-driven audit navigation.
 */

const CHESS_ICONS = {
    'brilliant': { file: 'brilliant.png', label: 'Блестяще', badgeClass: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/40' },
    'great': { file: 'great.png', label: 'Отлично', badgeClass: 'text-blue-400 bg-blue-950/40 border-blue-500/40' },
    'best': { file: 'best.png', label: 'Лучший ход', badgeClass: 'text-teal-400 bg-teal-950/40 border-teal-500/40' },
    'Excellent': { file: 'Excellent.png', label: 'Превосходно', badgeClass: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/40' },
    'Good': { file: 'Good.png', label: 'Хорошо', badgeClass: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/40' },
    'Book': { file: 'Book.png', label: 'По регламенту', badgeClass: 'text-blue-400 bg-blue-950/40 border-blue-500/40' },
    'Inaccuracy': { file: 'Inaccuracy.png', label: 'Неточность', badgeClass: 'text-yellow-400 bg-yellow-950/40 border-yellow-500/40' },
    'Mistake': { file: 'Mistake.png', label: 'Ошибка', badgeClass: 'text-orange-400 bg-orange-950/40 border-orange-500/40' },
    'Miss': { file: 'Miss.png', label: 'Пропуск', badgeClass: 'text-rose-400 bg-rose-950/40 border-rose-500/40' },
    'Blunder': { file: 'Blunder.png', label: 'Зевок / Нарушение', badgeClass: 'text-red-400 bg-red-950/60 border-red-500/60' }
};

let state = {
    dialogues: [],
    activeDialogue: null,
    checklist: null,
    selectedGroupId: 'DEV',
    showNaCriteria: false,
    showAppealsTab: false,
    batchPollingTimer: null
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    initTheme();
    setupEventListeners();
    setupKeyboardNavigation();
    await loadChecklist();
    await loadDialogues();
    await refreshAnalytics();
    checkBatchProgress();
}

// ----------------- Score Formatting Helper ----------------- //

/**
 * Eliminates fractional visual noise.
 * Rounds whole numbers to integers (100, 20, 0) and fractional numbers to 1 decimal place (92.3, 76.5, 30.8).
 */
function formatScore(val) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    const num = parseFloat(val);
    if (Math.abs(num - Math.round(num)) < 0.05) {
        return Math.round(num).toString();
    }
    return num.toFixed(1);
}

// ----------------- Theme Switcher ----------------- //

function initTheme() {
    const savedTheme = localStorage.getItem('cqa-theme') || 'dark';
    setTheme(savedTheme);

    const toggleBtn = document.getElementById('btnThemeToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleTheme);
    }
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        const icon = document.getElementById('themeIcon');
        const label = document.getElementById('themeLabel');
        if (icon) icon.className = 'fa-solid fa-sun text-amber-400';
        if (label) label.innerText = 'Светлая';
    } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
        const icon = document.getElementById('themeIcon');
        const label = document.getElementById('themeLabel');
        if (icon) icon.className = 'fa-solid fa-moon text-slate-300';
        if (label) label.innerText = 'Темная';
    }
    localStorage.setItem('cqa-theme', theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(current === 'dark' ? 'light' : 'dark');
    renderDialogueList();
    if (state.activeDialogue) {
        renderDialogueInspector();
    }
}

// ----------------- Event Listeners & Keyboard ----------------- //

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', renderDialogueList);
    document.getElementById('filterLanguage').addEventListener('change', renderDialogueList);
    document.getElementById('filterChannel').addEventListener('change', renderDialogueList);
    document.getElementById('filterStatus').addEventListener('change', renderDialogueList);

    document.getElementById('btnSyncModal').addEventListener('click', () => openModal('modalSync'));
    document.getElementById('btnChecklistConfig').addEventListener('click', openChecklistModal);
    document.getElementById('btnSupervisorPending').addEventListener('click', openSupervisorModal);
    document.getElementById('btnBatchEvaluate').addEventListener('click', triggerBatchEvaluation);
    document.getElementById('btnEvaluateSingle').addEventListener('click', triggerSingleEvaluation);
}

function setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        // Ignore if user is typing in form controls
        const tag = (e.target.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown') {
            e.preventDefault();
            navigateDialogueList(1);
        } else if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp') {
            e.preventDefault();
            navigateDialogueList(-1);
        } else if (e.code === 'Space') {
            e.preventDefault();
            jumpToFirstViolationOrQuote();
        }
    });
}

function navigateDialogueList(direction) {
    if (!state.dialogues || state.dialogues.length === 0) return;
    const currentId = state.activeDialogue ? state.activeDialogue.conversation_id : null;
    const filtered = getFilteredDialogues();
    if (filtered.length === 0) return;

    let currentIndex = filtered.findIndex(d => d.conversation_id === currentId);
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= filtered.length) nextIndex = filtered.length - 1;

    loadDialogue(filtered[nextIndex].conversation_id);
}

function jumpToFirstViolationOrQuote() {
    const dlg = state.activeDialogue;
    if (!dlg || !dlg.evaluation) return;

    // Look for first violation quote
    const crs = Object.values(dlg.evaluation.criteria_results || {});
    const viol = crs.find(c => (c.final_score === 0 || c.chess_badge === 'Blunder' || c.status === 'NO') && c.quote);
    if (viol) {
        window.jumpToQuote(viol.quote_timestamp, viol.quote);
        return;
    }
    // Otherwise jump to first quote
    const firstWithQuote = crs.find(c => c.quote && c.quote.trim().length > 0);
    if (firstWithQuote) {
        window.jumpToQuote(firstWithQuote.quote_timestamp, firstWithQuote.quote);
    }
}

// ----------------- API Calls ----------------- //

async function loadChecklist() {
    try {
        const res = await fetch('/api/checklist/active');
        state.checklist = await res.json();
    } catch (e) {
        console.error('Failed to load checklist:', e);
    }
}

async function loadDialogues() {
    try {
        const res = await fetch(`/api/dialogues?group_id=${state.selectedGroupId}`);
        const data = await res.json();
        state.dialogues = data.records || [];
        renderDialogueList();
        
        if (!state.activeDialogue && state.dialogues.length > 0) {
            await loadDialogue(state.dialogues[0].conversation_id);
        }
    } catch (e) {
        console.error('Failed to load dialogues:', e);
    }
}

async function refreshAnalytics() {
    try {
        const res = await fetch(`/api/analytics?group_id=${state.selectedGroupId}`);
        const data = await res.json();
        
        document.getElementById('statTotal').innerText = data.total_dialogues;
        document.getElementById('statEvaluated').innerText = data.evaluated_count;
        document.getElementById('statAvgScore').innerText = formatScore(data.avg_score);
        document.getElementById('statViolations').innerText = data.severe_violations_count;
        
        document.getElementById('totalCostHeader').innerText = `$${data.total_cost_usd.toFixed(4)}`;
        document.getElementById('avgLatencyHeader').innerText = `${data.avg_latency_ms} мс`;

        const pBadge = document.getElementById('pendingAppealsBadge');
        if (data.pending_appeals > 0) {
            pBadge.innerText = data.pending_appeals;
            pBadge.classList.remove('hidden');
        } else {
            pBadge.classList.add('hidden');
        }
    } catch (e) {
        console.error('Failed to load analytics:', e);
    }
}

async function loadDialogue(convId) {
    try {
        const res = await fetch(`/api/dialogues/${convId}`);
        const dlg = await res.json();
        state.activeDialogue = dlg;
        renderDialogueInspector();
        renderDialogueList();
    } catch (e) {
        console.error(`Failed to load dialogue ${convId}:`, e);
    }
}

// ----------------- Filter Helper ----------------- //

function getFilteredDialogues() {
    const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
    const lang = document.getElementById('filterLanguage').value;
    const channel = document.getElementById('filterChannel').value;
    const status = document.getElementById('filterStatus').value;

    return state.dialogues.filter(d => {
        if (search) {
            const idMatch = d.conversation_id.toLowerCase().includes(search);
            const snippetMatch = (d.client_snippet || '').toLowerCase().includes(search);
            if (!idMatch && !snippetMatch) return false;
        }
        if (lang && d.language !== lang) return false;
        if (channel && d.channel !== channel) return false;
        if (status === 'evaluated' && d.eval_status !== 'completed') return false;
        if (status === 'pending' && d.eval_status === 'completed') return false;
        if (status === 'violation' && !d.severe_violation) return false;
        if (status === 'appeals' && d.appeals_count <= 0) return false;
        return true;
    });
}

function getChessIconInfo(key) {
    return CHESS_ICONS[key] || null;
}

// ----------------- Column 1: Dialogue List ----------------- //

function renderDialogueList() {
    const container = document.getElementById('dialogueListContainer');
    const filtered = getFilteredDialogues();

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center text-[var(--fb-text-muted)] text-xs">
                <i class="fa-solid fa-filter text-base mb-1"></i>
                <p>Нет диалогов по заданным фильтрам</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(d => {
        const isActive = state.activeDialogue && state.activeDialogue.conversation_id === d.conversation_id;
        const activeClass = isActive 
            ? 'bg-[var(--fb-surface-subtle)] border-l-[3px] border-l-[#00bc58] shadow-xs' 
            : 'hover:bg-[var(--fb-surface-hover)] border-l-[3px] border-l-transparent';
        
        let scoreBadge = '';
        if (d.eval_status === 'completed') {
            const badgeKey = d.severe_violation ? 'Blunder' : (d.chess_badge || 'Book');
            const iconInfo = getChessIconInfo(badgeKey);
            const score = d.total_score;
            const scoreFormatted = formatScore(score);

            // Tier-based color coding
            let tierClass = 'text-emerald-400 bg-emerald-950/40 border-emerald-600/40';
            if (d.severe_violation || score < 60) {
                tierClass = 'text-rose-400 bg-rose-950/40 border-rose-600/40';
            } else if (score < 80) {
                tierClass = 'text-amber-400 bg-amber-950/40 border-amber-600/40';
            } else if (score < 95) {
                tierClass = 'text-teal-400 bg-teal-950/40 border-teal-600/40';
            }

            if (iconInfo) {
                scoreBadge = `
                    <div class="flex items-center gap-1 shrink-0 font-mono font-bold text-xs ${tierClass} px-1.5 py-0.5 rounded-md border" title="${iconInfo.label}">
                        <img src="/assets/rating icons/${iconInfo.file}" alt="${badgeKey}" class="chess-icon-xs">
                        <span>${scoreFormatted}</span>
                    </div>
                `;
            } else {
                scoreBadge = `<span class="px-1.5 py-0.5 rounded-md text-[10px] font-bold ${tierClass} border">${scoreFormatted}</span>`;
            }
        } else {
            scoreBadge = `<span class="px-1.5 py-0.5 rounded-md text-[10px] font-medium theme-surface-subtle text-[var(--fb-text-muted)] border border-[var(--fb-border)]">Ожидает</span>`;
        }

        const channelIcon = d.channel === 'voice call' 
            ? '<i class="fa-solid fa-phone text-purple-400 text-[10px]"></i>' 
            : '<i class="fa-regular fa-comments text-[var(--fb-accent-green)] text-[10px]"></i>';

        const appealsDot = d.appeals_count > 0 
            ? `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Есть апелляции"></span>` 
            : '';

        const snippetText = d.client_snippet 
            ? d.client_snippet.replace(/"/g, '&quot;') 
            : (d.channel === 'voice call' ? 'Аудиозапись входящего звонка' : 'Диалог без текста');

        return `
            <div onclick="window.loadDialogue('${d.conversation_id}')" class="px-3 py-2 cursor-pointer transition ${activeClass}">
                <div class="flex items-center justify-between gap-1.5">
                    <div class="flex items-center gap-1.5 min-w-0">
                        <span class="w-4 h-4 rounded bg-[var(--fb-surface-subtle)] flex items-center justify-center shrink-0">
                            ${channelIcon}
                        </span>
                        <span class="font-bold text-[var(--fb-text-primary)] font-mono truncate text-[11px]">${d.conversation_id}</span>
                        <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[var(--fb-tag-bg)] text-[var(--fb-tag-text)] shrink-0">${d.language}</span>
                        ${appealsDot}
                    </div>
                    <div class="shrink-0">
                        ${scoreBadge}
                    </div>
                </div>
                <div class="text-[11px] text-[var(--fb-text-muted)] truncate mt-0.5 pl-5">
                    ${snippetText}
                </div>
            </div>
        `;
    }).join('');
}

// ----------------- Columns 2 & 3: Persistent Side-by-Side ----------------- //

function renderDialogueInspector() {
    const dlg = state.activeDialogue;
    if (!dlg) return;

    // Header context in Column 2
    document.getElementById('activeConversationId').innerText = dlg.conversation_id;
    document.getElementById('activeLangBadge').innerText = dlg.language;

    const chName = dlg.channel === 'voice call' ? 'Звонок' : 'Чат';
    document.getElementById('activeChannelBadge').innerText = chName;

    const chIcon = document.getElementById('activeChannelIcon');
    if (dlg.channel === 'voice call') {
        chIcon.innerHTML = '<i class="fa-solid fa-phone text-purple-400"></i>';
        chIcon.className = 'w-7 h-7 rounded-lg bg-purple-950/40 text-purple-400 flex items-center justify-center text-xs shrink-0 border border-purple-500/40';
    } else {
        chIcon.innerHTML = '<i class="fa-regular fa-comments text-[var(--fb-accent-green)]"></i>';
        chIcon.className = 'w-7 h-7 rounded-lg bg-[var(--fb-accent-green-subtle)] text-[var(--fb-accent-green)] flex items-center justify-center text-xs shrink-0 border border-[var(--fb-border)]';
    }

    document.getElementById('activeMsgCount').innerText = `${dlg.transcript ? dlg.transcript.length : 0} сообщений`;

    // Voice Call Audio Button
    const voiceControl = document.getElementById('voiceCallControl');
    if (dlg.audio_url) {
        voiceControl.classList.remove('hidden');
        document.getElementById('btnExternalAudio').href = dlg.audio_url;
    } else {
        voiceControl.classList.add('hidden');
    }

    // Evaluation data in Column 3
    const evalData = dlg.evaluation;
    const scorePill = document.getElementById('scoreHeaderPill');
    const severeAlert = document.getElementById('severeAlertBadge');
    const noEvalNotice = document.getElementById('noEvaluationNotice');
    const evalCard = document.getElementById('evaluationCard');

    if (evalData) {
        scorePill.classList.remove('hidden');
        document.getElementById('activeTotalScore').innerText = formatScore(evalData.total_score);
        
        // Chess Rating Badge in Column 3 Header
        const badgeKey = evalData.severe_violation ? 'Blunder' : (evalData.chess_badge || 'Book');
        const iconInfo = getChessIconInfo(badgeKey);
        const headerIcon = document.getElementById('headerChessIcon');
        
        if (iconInfo) {
            headerIcon.src = `/assets/rating icons/${iconInfo.file}`;
            headerIcon.alt = badgeKey;
            headerIcon.classList.remove('hidden');
            document.getElementById('headerChessLabel').innerText = iconInfo.label;
        } else {
            headerIcon.classList.add('hidden');
            document.getElementById('headerChessLabel').innerText = 'Оценка CQA';
        }

        if (evalData.severe_violation) {
            severeAlert.classList.remove('hidden');
        } else {
            severeAlert.classList.add('hidden');
        }

        // Clean Separated Metadata Bar (No cramming!)
        const latSec = (evalData.latency_ms / 1000).toFixed(1);
        document.getElementById('evalMetaModel').innerText = `Модель: ${evalData.model_used || 'Groq'}`;
        document.getElementById('evalMetaLatency').innerText = `Задержка: ${latSec}с`;
        document.getElementById('evalMetaCost').innerText = `Расход: $${(evalData.cost_usd || 0).toFixed(4)}`;

        noEvalNotice.classList.add('hidden');
        evalCard.classList.remove('hidden');

        renderSegmentedCategoryScores(evalData.section_scores, evalData.total_score);
        renderMonolithicCriteria(evalData.criteria_results);
        document.getElementById('evalSummaryFeedback').innerText = evalData.summary_feedback || 'Оценка завершена в штатном режиме.';
    } else {
        scorePill.classList.add('hidden');
        severeAlert.classList.add('hidden');
        document.getElementById('evalMetaLatency').innerText = 'Задержка: —';
        document.getElementById('evalMetaCost').innerText = 'Расход: —';
        noEvalNotice.classList.remove('hidden');
        evalCard.classList.add('hidden');
    }

    renderTranscript();
    renderAppealsList();
}

// ----------------- Segmented Category Score Bar ----------------- //

function renderSegmentedCategoryScores(sections, totalScore) {
    const container = document.getElementById('sectionScoresContainer');
    const summaryText = document.getElementById('categoryScoresSummaryText');
    if (!sections || Object.keys(sections).length === 0) {
        container.innerHTML = '';
        if (summaryText) summaryText.innerText = '';
        return;
    }

    if (summaryText) {
        summaryText.innerText = `${formatScore(totalScore)} / 100 б`;
    }

    const sectionColors = [
        'bg-emerald-500', // Начало и запрос
        'bg-teal-500',    // Безопасность и решение
        'bg-blue-500'     // Ведение и завершение
    ];

    let idx = 0;
    container.innerHTML = Object.entries(sections).map(([name, val]) => {
        const earned = val.earned || 0;
        const max = val.max || 1;
        const pct = Math.min(Math.round((earned / 100) * 100), 100);
        const color = sectionColors[idx % sectionColors.length];
        idx++;

        return `
            <div class="segmented-segment ${color}" style="width: ${pct}%" title="${name}: ${formatScore(earned)} / ${formatScore(max)} б"></div>
        `;
    }).join('');
}

// ----------------- 8 Criteria Checklist Rendering ----------------- //

window.toggleNaVisibility = function() {
    state.showNaCriteria = !state.showNaCriteria;
    if (state.activeDialogue && state.activeDialogue.evaluation) {
        renderMonolithicCriteria(state.activeDialogue.evaluation.criteria_results);
    }
};

function renderMonolithicCriteria(criteriaResults) {
    const container = document.getElementById('criteriaMonolithicContainer');
    if (!criteriaResults) {
        container.innerHTML = '';
        return;
    }

    const rows = Object.values(criteriaResults).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    
    // Count N/A items
    const naCount = rows.filter(r => r.is_na || r.status === 'NA').length;
    const naBtnText = document.getElementById('naToggleText');
    if (naBtnText) {
        naBtnText.innerText = state.showNaCriteria ? 'Скрыть N/A' : `Показать N/A (${naCount})`;
    }

    container.innerHTML = rows.map(item => {
        const isNA = item.is_na || item.status === 'NA';
        if (isNA && !state.showNaCriteria) {
            return ''; // Hidden when collapsed
        }

        const badgeKey = item.chess_badge;
        const iconInfo = (!isNA && badgeKey) ? getChessIconInfo(badgeKey) : null;
        const isViolation = (!isNA && (item.final_score === 0 || badgeKey === 'Blunder' || item.status === 'NO'));

        // Chess Badge or N/A Badge
        let chessBadgeHtml = '';
        if (isNA) {
            chessBadgeHtml = `
                <div class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded border border-[var(--fb-border)] theme-surface-subtle text-[var(--fb-text-muted)] font-bold text-[9px]">
                    <span>N/A</span>
                    <span class="font-normal text-[8px]">(не требуется)</span>
                </div>
            `;
        } else if (iconInfo) {
            chessBadgeHtml = `
                <div class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded border ${iconInfo.badgeClass} font-bold text-[10px]" title="${iconInfo.label}">
                    <img src="/assets/rating icons/${iconInfo.file}" alt="${badgeKey}" class="chess-icon-xs">
                    <span>${iconInfo.label}</span>
                </div>
            `;
        } else {
            chessBadgeHtml = `<span class="px-1.5 py-0.2 rounded theme-surface-subtle text-[var(--fb-text-secondary)] font-bold text-[9px]">${item.status}</span>`;
        }

        // Clean Score Display without fractional clutter
        let scoreDisplay = '';
        if (isNA) {
            scoreDisplay = `
                <div class="text-right">
                    <span class="font-mono font-bold text-[var(--fb-text-muted)] text-[11px]">—</span>
                    <div class="text-[9px] text-[var(--fb-text-muted)]">перераспределен</div>
                </div>
            `;
        } else if (isViolation) {
            scoreDisplay = `
                <div class="text-right">
                    <span class="font-mono font-bold text-rose-500 text-xs">${formatScore(item.final_score)}</span>
                    <span class="text-[var(--fb-text-muted)] font-mono text-[10px]">/ ${formatScore(item.redistributed_weight)} б</span>
                    <div class="text-[9px] text-[var(--fb-text-muted)] font-mono">вес: ${item.base_weight}</div>
                </div>
            `;
        } else {
            scoreDisplay = `
                <div class="text-right">
                    <span class="font-mono font-bold text-[var(--fb-accent-green)] text-xs">${formatScore(item.final_score)}</span>
                    <span class="text-[var(--fb-text-muted)] font-mono text-[10px]">/ ${formatScore(item.redistributed_weight)} б</span>
                    <div class="text-[9px] text-[var(--fb-text-muted)] font-mono">вес: ${item.base_weight}</div>
                </div>
            `;
        }

        const isDisputed = state.activeDialogue && state.activeDialogue.appeals && 
            state.activeDialogue.appeals.some(a => a.criterion_id === item.criterion_id && a.status === 'pending');

        const disputeAction = isDisputed 
            ? '<span class="text-[9px] text-amber-500 font-semibold flex items-center gap-0.5 shrink-0"><i class="fa-solid fa-clock"></i> Оспаривается</span>'
            : `<button onclick="window.openAppealModal('${item.criterion_id}')" class="px-1.5 py-0.5 text-[10px] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] hover:bg-[var(--fb-surface-subtle)] rounded border border-[var(--fb-border)] transition shrink-0">Оспорить</button>`;

        // Integrated Quote block directly below the criterion (ONLY IF QUOTE EXISTS AND NOT EMPTY)
        let quoteHtml = '';
        if (item.quote && item.quote.trim().length > 0 && !isNA) {
            const cleanQuoteForCall = item.quote.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const quoteClass = isViolation ? 'quote-box quote-box-violation' : 'quote-box';
            quoteHtml = `
                <div onclick="window.jumpToQuote('${item.quote_timestamp || ''}', '${cleanQuoteForCall}')" 
                    class="mt-1.5 p-2 rounded-lg cursor-pointer transition flex items-start gap-2 text-[10px] ${quoteClass}"
                    title="Кликните для перехода к фразе в транскрипте">
                    <i class="fa-solid fa-quote-left text-[var(--fb-accent-green)] mt-0.5 shrink-0 text-[10px]"></i>
                    <div class="min-w-0 flex-1">
                        <span class="font-mono font-bold text-[var(--fb-accent-green)] mr-1">[${item.quote_timestamp || '—'}]</span>
                        <span class="italic text-[var(--fb-text-primary)]">"${item.quote}"</span>
                    </div>
                    <span class="text-[9px] text-[var(--fb-accent-green)] font-semibold shrink-0 ml-1">Перейти ↵</span>
                </div>
            `;
        }

        // Highlight violation row border
        const rowHighlight = isViolation ? 'border-l-[3px] border-l-rose-500 bg-rose-950/10' : '';

        return `
            <div class="p-2.5 hover:bg-[var(--fb-surface-hover)] transition ${rowHighlight}">
                <!-- Top Row: Icon + Name + Score + Action -->
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5 min-w-0 flex-1">
                        <span class="font-mono font-bold text-[var(--fb-text-muted)] text-[11px] shrink-0">${item.code || ''}</span>
                        <div class="shrink-0">
                            ${chessBadgeHtml}
                        </div>
                        <div class="min-w-0">
                            <span class="font-bold text-[var(--fb-text-primary)] text-[11px]">${item.name}</span>
                            <span class="text-[9px] text-[var(--fb-text-muted)] uppercase tracking-tight ml-1">• ${item.section}</span>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                        ${scoreDisplay}
                        ${disputeAction}
                    </div>
                </div>

                <!-- Bottom Block: Reasoning & Quote in-place -->
                <div class="mt-1 pl-5">
                    <div class="text-[10px] text-[var(--fb-text-secondary)] leading-relaxed font-normal">${item.reasoning || ''}</div>
                    ${quoteHtml}
                </div>
            </div>
        `;
    }).join('');
}

// ----------------- Column 2: Transcript Messages ----------------- //

function renderTranscript() {
    const list = document.getElementById('transcriptMessagesList');
    const dlg = state.activeDialogue;
    if (!dlg || !dlg.transcript) {
        list.innerHTML = '<p class="text-center text-[var(--fb-text-muted)] text-xs py-6">Транскрипт пуст</p>';
        return;
    }

    list.innerHTML = dlg.transcript.map((msg, idx) => {
        const isOperator = msg.speaker === 'operator';
        const isClient = msg.speaker === 'client';
        const isBot = msg.speaker === 'bot';

        let roleBadge = '';
        let bubbleClass = '';
        let alignClass = '';

        if (isOperator) {
            roleBadge = '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950/50 text-emerald-300 border border-emerald-700/50">Оператор</span>';
            bubbleClass = 'theme-surface border-l-3 border-l-[#00bc58] border-[var(--fb-border)]';
            alignClass = 'ml-6';
        } else if (isClient) {
            roleBadge = '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-950/50 text-blue-300 border border-blue-700/50">Клиент</span>';
            bubbleClass = 'theme-surface-subtle border-l-3 border-l-blue-500 border-[var(--fb-border)]';
            alignClass = 'mr-6';
        } else if (isBot) {
            roleBadge = '<span class="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-purple-950/50 text-purple-300 border border-purple-700/50">AI-Бот</span>';
            bubbleClass = 'theme-surface border border-purple-500/40';
            alignClass = 'mx-4';
        } else {
            roleBadge = '<span class="px-1.5 py-0.2 rounded text-[9px] font-medium theme-surface-subtle text-[var(--fb-text-muted)]">Система</span>';
            bubbleClass = 'theme-surface-subtle border border-[var(--fb-border-light)] text-[var(--fb-text-muted)] italic text-[10px]';
            alignClass = 'mx-6';
        }

        return `
            <div id="transcript-msg-${idx}" data-ts="${msg.timestamp}" data-text="${encodeURIComponent(msg.text)}" 
                class="p-2.5 rounded-xl border transition shadow-2xs text-xs ${bubbleClass} ${alignClass}">
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-1.5">
                        ${roleBadge}
                        <span class="font-mono text-[9px] text-[var(--fb-text-muted)]">${msg.timestamp}</span>
                    </div>
                </div>
                <div class="text-[var(--fb-text-primary)] leading-relaxed">
                    ${msg.text}
                </div>
            </div>
        `;
    }).join('');
}

// ----------------- Jump To Quote in Transcript ----------------- //

window.jumpToQuote = function(timestamp, quoteText) {
    const msgs = document.querySelectorAll('#transcriptMessagesList > div');
    let target = null;

    if (timestamp) {
        for (let el of msgs) {
            if (el.getAttribute('data-ts') === timestamp) {
                target = el;
                break;
            }
        }
    }

    if (!target && quoteText) {
        const cleanQuote = quoteText.toLowerCase().replace(/['"«»]/g, '').trim();
        for (let el of msgs) {
            const txt = decodeURIComponent(el.getAttribute('data-text') || '').toLowerCase();
            if (txt.includes(cleanQuote) || cleanQuote.includes(txt)) {
                target = el;
                break;
            }
        }
    }

    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('highlight-pulse');
        setTimeout(() => {
            target.classList.remove('highlight-pulse');
        }, 2500);
    }
};

// ----------------- Appeals Rendering & Drawer ----------------- //

window.switchChecklistView = function(view) {
    const appealsSec = document.getElementById('dialogueAppealsSection');
    if (!appealsSec) return;

    if (view === 'appeals') {
        state.showAppealsTab = !state.showAppealsTab;
        if (state.showAppealsTab) {
            appealsSec.classList.remove('hidden');
            appealsSec.scrollIntoView({ behavior: 'smooth' });
        } else {
            appealsSec.classList.add('hidden');
        }
    }
};

function renderAppealsList() {
    const container = document.getElementById('dialogueAppealsList');
    const badge = document.getElementById('tabAppealsBadge');
    const appealsSec = document.getElementById('dialogueAppealsSection');
    const dlg = state.activeDialogue;
    if (!dlg || !dlg.appeals || dlg.appeals.length === 0) {
        if (container) {
            container.innerHTML = `
                <div class="p-3 text-center text-[var(--fb-text-muted)] text-[10px]">
                    <p>По данному диалогу апелляций пока нет.</p>
                </div>
            `;
        }
        if (badge) badge.classList.add('hidden');
        return;
    }

    if (badge) {
        badge.innerText = dlg.appeals.length;
        badge.classList.remove('hidden');
    }
    if (appealsSec) {
        appealsSec.classList.remove('hidden');
    }

    container.innerHTML = dlg.appeals.map(a => {
        const isPending = a.status === 'pending';
        const isApproved = a.status === 'approved';
        
        let statusBadge = '';
        if (isPending) {
            statusBadge = '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-950/50 text-amber-300 border border-amber-600/50">На рассмотрении</span>';
        } else if (isApproved) {
            statusBadge = '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950/50 text-emerald-300 border border-emerald-600/50">Одобрено</span>';
        } else {
            statusBadge = '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-950/50 text-rose-300 border border-rose-600/50">Отклонено</span>';
        }

        let resolutionBlock = '';
        if (!isPending) {
            resolutionBlock = `
                <div class="mt-1.5 pt-1.5 border-t border-[var(--fb-border-light)] text-[10px]">
                    <div class="font-semibold text-[var(--fb-text-primary)]">Решение проверяющего:</div>
                    <div class="text-[var(--fb-text-secondary)] italic">"${a.supervisor_comment || 'Без комментария'}"</div>
                    <div class="text-[9px] text-[var(--fb-text-muted)] mt-0.5">Итог: <strong>${formatScore(a.resolved_score)}</strong> (${a.resolved_at || ''})</div>
                </div>
            `;
        }

        return `
            <div class="p-2.5 theme-surface-subtle rounded-xl border border-[var(--fb-border)] text-xs space-y-1">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-[var(--fb-text-primary)] text-[10px]">Критерий: ${a.criterion_id}</span>
                    ${statusBadge}
                </div>
                <div class="text-[10px] text-[var(--fb-text-secondary)]">
                    Балл AI: <strong>${formatScore(a.original_score)}</strong> → Запрос: <strong class="text-amber-400">${formatScore(a.proposed_score)}</strong>
                </div>
                <div class="text-[10px] text-[var(--fb-text-primary)] italic theme-surface p-2 rounded-lg border border-[var(--fb-border-light)]">
                    "${a.operator_comment}"
                </div>
                ${resolutionBlock}
            </div>
        `;
    }).join('');
}

// ----------------- Appeals Modal Logic ----------------- //

window.openModal = function(id) {
    document.getElementById(id).classList.remove('hidden');
};

window.closeModal = function(id) {
    document.getElementById(id).classList.add('hidden');
};

window.openAppealModal = function(criterionId) {
    const dlg = state.activeDialogue;
    if (!dlg || !dlg.evaluation) {
        alert('Для подачи апелляции диалог должен быть сначала оценен.');
        return;
    }

    const select = document.getElementById('appealCriterionSelect');
    const chk = state.checklist;
    if (!chk) return;

    select.innerHTML = chk.criteria.map(c => `
        <option value="${c.id}" ${c.id === criterionId ? 'selected' : ''}>
            ${c.code} ${c.name} (Макс. вес ${c.weight})
        </option>
    `).join('');

    const crRes = dlg.evaluation.criteria_results[criterionId || chk.criteria[0].id] || {};
    document.getElementById('appealProposedScore').value = crRes.raw_score || 0;
    document.getElementById('appealOperatorComment').value = '';

    openModal('modalAppeal');
};

window.handleAppealSubmit = async function(e) {
    e.preventDefault();
    const dlg = state.activeDialogue;
    if (!dlg) return;

    const criterionId = document.getElementById('appealCriterionSelect').value;
    const proposedScore = parseFloat(document.getElementById('appealProposedScore').value);
    const comment = document.getElementById('appealOperatorComment').value.trim();

    try {
        const res = await fetch('/api/appeals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversation_id: dlg.conversation_id,
                criterion_id: criterionId,
                proposed_score: proposedScore,
                operator_comment: comment
            })
        });

        if (res.ok) {
            closeModal('modalAppeal');
            alert('Апелляция успешно направлена супервизору!');
            await loadDialogue(dlg.conversation_id);
            await refreshAnalytics();
        } else {
            const err = await res.json();
            alert(`Ошибка подачи апелляции: ${err.detail || 'Неизвестная ошибка'}`);
        }
    } catch (err) {
        console.error('Failed to submit appeal:', err);
    }
};

// ----------------- Supervisor Cabinet ----------------- //

async function openSupervisorModal() {
    openModal('modalSupervisor');
    const container = document.getElementById('supervisorAppealsList');
    container.innerHTML = '<p class="text-center text-[var(--fb-text-muted)] py-4">Загрузка апелляций...</p>';

    try {
        const res = await fetch('/api/appeals/pending');
        const appeals = await res.json();

        if (appeals.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center text-[var(--fb-text-muted)]">
                    <i class="fa-solid fa-check-double text-2xl text-[var(--fb-accent-green)] mb-2"></i>
                    <p class="font-medium">Все апелляции рассмотрены!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = appeals.map(a => `
            <div class="p-3 theme-surface-subtle rounded-xl border border-[var(--fb-border)] space-y-2">
                <div class="flex items-center justify-between">
                    <div>
                        <span class="font-bold font-mono text-[var(--fb-text-primary)] text-xs">${a.conversation_id}</span>
                        <span class="text-[11px] text-[var(--fb-text-muted)] ml-2">• Критерий: <strong>${a.criterion_id}</strong></span>
                    </div>
                    <span class="text-[10px] text-[var(--fb-text-muted)]">${a.created_at || ''}</span>
                </div>

                <div class="text-[11px] text-[var(--fb-text-secondary)]">
                    Балл AI: <strong>${formatScore(a.original_score)}</strong> → Запрос: <strong class="text-amber-400">${formatScore(a.proposed_score)}</strong>
                </div>

                <div class="italic text-[11px] theme-surface p-2 rounded-lg border border-[var(--fb-border-light)] text-[var(--fb-text-primary)]">
                    "${a.operator_comment}"
                </div>

                <div class="flex items-center gap-2 pt-2 border-t border-[var(--fb-border-light)]">
                    <input type="text" id="sup_comment_${a.id}" placeholder="Комментарий супервизора..." 
                        class="flex-1 py-1 px-2 text-xs theme-input rounded-lg border border-[var(--fb-border)]">
                    
                    <button onclick="window.resolveAppeal(${a.id}, 'approved', ${a.proposed_score})" 
                        class="px-2.5 py-1 bg-[#00bc58] hover:bg-[#00a84e] text-white rounded-lg text-xs font-medium flex items-center gap-1 transition">
                        <i class="fa-solid fa-check"></i> Одобрить
                    </button>
                    <button onclick="window.resolveAppeal(${a.id}, 'rejected', ${a.original_score})" 
                        class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition">
                        <i class="fa-solid fa-xmark"></i> Отклонить
                    </button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load pending appeals:', e);
    }
}

window.resolveAppeal = async function(appealId, status, score) {
    const commentInput = document.getElementById(`sup_comment_${appealId}`);
    const comment = commentInput ? commentInput.value.trim() : '';

    try {
        const res = await fetch(`/api/appeals/${appealId}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: status,
                supervisor_comment: comment || (status === 'approved' ? 'Согласовано супервизором' : 'Отклонено супервизором'),
                resolved_score: score
            })
        });

        if (res.ok) {
            await openSupervisorModal();
            await refreshAnalytics();
            if (state.activeDialogue) {
                await loadDialogue(state.activeDialogue.conversation_id);
            }
        }
    } catch (e) {
        console.error('Failed to resolve appeal:', e);
    }
};

// ----------------- Checklist Configuration Editor ----------------- //

async function openChecklistModal() {
    await loadChecklist();
    renderChecklistEditor();
    openModal('modalChecklist');
}

function renderChecklistEditor() {
    const container = document.getElementById('checklistEditorContainer');
    const chk = state.checklist;
    if (!chk || !chk.criteria) return;

    container.innerHTML = chk.criteria.map((c, idx) => `
        <div class="p-3 theme-surface-subtle rounded-xl border border-[var(--fb-border)] space-y-2" data-crit-index="${idx}">
            <div class="flex items-center gap-2">
                <input type="text" class="crit-code w-14 py-1 px-1.5 text-xs font-mono font-bold theme-input rounded-lg border border-[var(--fb-border)]" value="${c.code}">
                <input type="text" class="crit-name flex-1 py-1 px-2 text-xs font-bold theme-input rounded-lg border border-[var(--fb-border)]" value="${c.name}">
                <input type="number" step="1" class="crit-weight w-16 py-1 px-1.5 text-xs text-right font-mono theme-input rounded-lg border border-[var(--fb-border)]" value="${c.weight}" title="Вес критерия">
                <span class="text-[11px] text-[var(--fb-text-muted)] font-mono">вес</span>
                <button onclick="window.removeCriterionRow(${idx})" class="text-rose-400 hover:text-rose-500 p-1" title="Удалить">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
            <div class="flex items-center gap-3 text-[11px] text-[var(--fb-text-secondary)]">
                <span class="text-[var(--fb-text-muted)]">Раздел:</span>
                <input type="text" class="crit-section flex-1 py-0.5 px-2 text-xs theme-input rounded-lg border border-[var(--fb-border)]" value="${c.section}">
                <label class="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" class="crit-allow-na rounded" ${c.allow_na ? 'checked' : ''}>
                    <span>Разрешить N/A</span>
                </label>
            </div>
            <textarea class="crit-desc w-full py-1 px-2 text-xs theme-input rounded-lg border border-[var(--fb-border)]" rows="2">${c.description}</textarea>
        </div>
    `).join('');
}

window.addNewCriterionRow = function() {
    const chk = state.checklist;
    const newIdx = chk.criteria.length + 1;
    chk.criteria.push({
        id: `custom_crit_${Date.now()}`,
        code: `0${newIdx}`,
        name: "Новый критерий контроля",
        section: "ДОПОЛНИТЕЛЬНО",
        type: "YES_NO",
        weight: 10,
        allow_na: true,
        max_scale: 1,
        description: "Да: условие выполнено. Нет: условие не выполнено. N/A: не применимо.",
        scale_rubric: null
    });
    renderChecklistEditor();
};

window.removeCriterionRow = function(index) {
    state.checklist.criteria.splice(index, 1);
    renderChecklistEditor();
};

window.saveChecklistConfig = async function() {
    const container = document.getElementById('checklistEditorContainer');
    const rows = container.querySelectorAll('[data-crit-index]');
    
    rows.forEach((row, i) => {
        const crit = state.checklist.criteria[i];
        if (crit) {
            crit.code = row.querySelector('.crit-code').value.trim();
            crit.name = row.querySelector('.crit-name').value.trim();
            crit.weight = parseFloat(row.querySelector('.crit-weight').value) || 0;
            crit.section = row.querySelector('.crit-section').value.trim();
            crit.allow_na = row.querySelector('.crit-allow-na').checked;
            crit.description = row.querySelector('.crit-desc').value.trim();
        }
    });

    try {
        const res = await fetch('/api/checklist/active', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: state.checklist.name,
                criteria: state.checklist.criteria
            })
        });

        if (res.ok) {
            state.checklist = await res.json();
            closeModal('modalChecklist');
            alert('Конфигурация чек-листа сохранена!');
            if (state.activeDialogue) {
                await triggerSingleEvaluation();
            }
        }
    } catch (e) {
        console.error('Failed to save checklist:', e);
    }
};

// ----------------- Evaluations & Batch ----------------- //

async function triggerSingleEvaluation() {
    const dlg = state.activeDialogue;
    if (!dlg) return;

    const btn = document.getElementById('btnEvaluateSingle');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Оценка...</span>';
    btn.disabled = true;

    try {
        const res = await fetch(`/api/evaluate/${dlg.conversation_id}`, { method: 'POST' });
        if (res.ok) {
            const updated = await res.json();
            state.activeDialogue = updated;
            renderDialogueInspector();
            await refreshAnalytics();
            await loadDialogues();
        } else {
            const err = await res.json();
            alert(`Ошибка оценки: ${err.detail || 'Не удалось выполнить оценку'}`);
        }
    } catch (e) {
        console.error('Failed to evaluate:', e);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

function checkBatchProgress() {
    if (state.batchPollingTimer) clearInterval(state.batchPollingTimer);

    state.batchPollingTimer = setInterval(async () => {
        try {
            const res = await fetch('/api/evaluate/progress');
            const data = await res.json();

            const bar = document.getElementById('batchProgressBar');
            if (data.is_running) {
                bar.classList.remove('hidden');
                document.getElementById('batchProgressText').innerText = `${data.completed} / ${data.total}`;
                document.getElementById('batchCurrentId').innerText = `(${data.current_id})`;
                const pct = data.total > 0 ? (data.completed / data.total) * 100 : 0;
                document.getElementById('batchProgressFill').style.width = `${pct}%`;
            } else {
                bar.classList.add('hidden');
                if (data.total > 0 && data.completed === data.total) {
                    await refreshAnalytics();
                    await loadDialogues();
                    if (state.activeDialogue) {
                        await loadDialogue(state.activeDialogue.conversation_id);
                    }
                }
            }
        } catch (e) {
            console.error('Batch polling error:', e);
        }
    }, 1200);
}

// ----------------- Dataset Sync ----------------- //

window.handleRunSync = async function() {
    const groupId = document.getElementById('syncGroupIdInput').value.trim() || 'DEV';
    const btn = document.getElementById('btnRunSync');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Загрузка...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group_id: groupId })
        });
        const data = await res.json();
        if (data.status === 'success') {
            state.selectedGroupId = groupId;
            closeModal('modalSync');
            alert(`Успешно загружено ${data.synced_records} диалогов (набор ${groupId})!`);
            await loadDialogues();
            await refreshAnalytics();
        } else {
            alert('Ошибка синхронизации: ' + JSON.stringify(data));
        }
    } catch (e) {
        console.error('Sync error:', e);
        alert('Ошибка при выполнении запроса синхронизации.');
    } finally {
        btn.innerHTML = 'Загрузить';
        btn.disabled = false;
    }
};

async function triggerBatchEvaluation() {
    if (!confirm('Запустить автоматическую оценку диалогов пула обращений?')) return;

    try {
        const res = await fetch('/api/evaluate/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group_id: state.selectedGroupId, reevaluate_all: false })
        });
        await res.json();
        checkBatchProgress();
    } catch (e) {
        console.error('Failed to trigger batch evaluation:', e);
    }
}
