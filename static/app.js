/**
 * Freedom Broker CQA - High-Density Financial CRM Frontend Logic
 * Authentic Chess Move Ratings + Monolithic Criteria CRM
 */

const CHESS_ICONS = {
    'brilliant': { file: 'brilliant.png', label: 'Блестяще', badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
    'great': { file: 'great.png', label: 'Отлично', badgeClass: 'text-blue-700 bg-blue-50 border-blue-300' },
    'best': { file: 'best.png', label: 'Лучший ход', badgeClass: 'text-teal-700 bg-teal-50 border-teal-300' },
    'Excellent': { file: 'Excellent.png', label: 'Превосходно', badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
    'Good': { file: 'Good.png', label: 'Хорошо', badgeClass: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
    'Book': { file: 'Book.png', label: 'По регламенту', badgeClass: 'text-amber-800 bg-amber-50 border-amber-300' },
    'Inaccuracy': { file: 'Inaccuracy.png', label: 'Неточность', badgeClass: 'text-yellow-800 bg-yellow-50 border-yellow-300' },
    'Mistake': { file: 'Mistake.png', label: 'Ошибка', badgeClass: 'text-orange-800 bg-orange-50 border-orange-300' },
    'Miss': { file: 'Miss.png', label: 'Пропуск', badgeClass: 'text-rose-800 bg-rose-50 border-rose-300' },
    'Blunder': { file: 'Blunder.png', label: 'Зевок / Нарушение', badgeClass: 'text-red-900 bg-red-100 border-red-400' }
};

let state = {
    dialogues: [],
    activeDialogue: null,
    checklist: null,
    activeTab: 'score',
    selectedGroupId: 'DEV',
    batchPollingTimer: null
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupEventListeners();
    await loadChecklist();
    await loadDialogues();
    await refreshAnalytics();
    checkBatchProgress();
}

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
        document.getElementById('statAvgScore').innerText = data.avg_score.toFixed(1);
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

// ----------------- Rendering ----------------- //

function getChessIconInfo(key) {
    return CHESS_ICONS[key] || null;
}

function renderDialogueList() {
    const container = document.getElementById('dialogueListContainer');
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const lang = document.getElementById('filterLanguage').value;
    const channel = document.getElementById('filterChannel').value;
    const status = document.getElementById('filterStatus').value;

    const filtered = state.dialogues.filter(d => {
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

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center text-slate-400 text-xs">
                <i class="fa-solid fa-filter text-base mb-1"></i>
                <p>Нет диалогов по заданным фильтрам</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(d => {
        const isActive = state.activeDialogue && state.activeDialogue.conversation_id === d.conversation_id;
        const activeClass = isActive 
            ? 'bg-emerald-50/80 border-l-[3px] border-l-[#00965e]' 
            : 'hover:bg-slate-50 border-l-[3px] border-l-transparent';
        
        let scoreBadge = '';
        if (d.eval_status === 'completed') {
            const badgeKey = d.severe_violation ? 'Blunder' : (d.chess_badge || 'Book');
            const iconInfo = getChessIconInfo(badgeKey);

            if (iconInfo) {
                scoreBadge = `
                    <div class="flex items-center gap-1 shrink-0 font-mono font-bold text-xs ${iconInfo.badgeClass} px-1.5 py-0.5 rounded border" title="${iconInfo.label}">
                        <img src="/assets/rating icons/${iconInfo.file}" alt="${badgeKey}" class="chess-icon-xs">
                        <span>${d.total_score.toFixed(1)}</span>
                    </div>
                `;
            } else {
                scoreBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">${d.total_score.toFixed(1)}</span>`;
            }
        } else {
            scoreBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">Ожидает</span>`;
        }

        const channelIcon = d.channel === 'voice call' 
            ? '<i class="fa-solid fa-phone text-purple-600 text-[10px]"></i>' 
            : '<i class="fa-regular fa-comments text-[#00965e] text-[10px]"></i>';

        const appealsDot = d.appeals_count > 0 
            ? `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Есть апелляции"></span>` 
            : '';

        const snippetText = d.client_snippet 
            ? d.client_snippet.replace(/"/g, '&quot;') 
            : (d.channel === 'voice call' ? 'Аудиозапись входящего звонка' : 'Диалог без текста');

        return `
            <div onclick="window.loadDialogue('${d.conversation_id}')" class="px-3 py-2 cursor-pointer transition ${activeClass}">
                <div class="flex items-center justify-between gap-1">
                    <div class="flex items-center gap-1.5 min-w-0">
                        <span class="w-4 h-4 rounded bg-slate-100 flex items-center justify-center shrink-0">
                            ${channelIcon}
                        </span>
                        <span class="font-bold text-slate-900 font-mono truncate text-[11px]">${d.conversation_id}</span>
                        <span class="px-1 py-0.2 rounded text-[9px] font-bold bg-slate-200 text-slate-700 shrink-0">${d.language}</span>
                        ${appealsDot}
                    </div>
                    <div class="shrink-0">
                        ${scoreBadge}
                    </div>
                </div>
                <div class="text-[11px] text-slate-500 truncate mt-0.5 pl-5">
                    ${snippetText}
                </div>
            </div>
        `;
    }).join('');
}

function renderDialogueInspector() {
    const dlg = state.activeDialogue;
    if (!dlg) return;

    // Header context
    document.getElementById('activeConversationId').innerText = dlg.conversation_id;
    document.getElementById('navActiveConvId').innerText = dlg.conversation_id;
    
    document.getElementById('activeLangBadge').innerText = dlg.language;
    document.getElementById('navActiveLang').innerText = dlg.language;

    const chName = dlg.channel === 'voice call' ? 'Звонок' : 'Чат';
    document.getElementById('activeChannelBadge').innerText = chName;
    document.getElementById('navActiveChannel').innerText = `• ${chName}`;

    const chIcon = document.getElementById('activeChannelIcon');
    const navAudioBadge = document.getElementById('navActiveAudioBadge');
    if (dlg.channel === 'voice call') {
        chIcon.innerHTML = '<i class="fa-solid fa-phone text-purple-600"></i>';
        chIcon.className = 'w-8 h-8 rounded bg-purple-50 text-purple-600 flex items-center justify-center text-xs shrink-0 border border-purple-200';
        navAudioBadge.classList.remove('hidden');
    } else {
        chIcon.innerHTML = '<i class="fa-regular fa-comments text-[#00965e]"></i>';
        chIcon.className = 'w-8 h-8 rounded bg-emerald-50 text-[#00965e] flex items-center justify-center text-xs shrink-0 border border-emerald-200';
        navAudioBadge.classList.add('hidden');
    }

    document.getElementById('activeMsgCount').innerText = `Сообщений: ${dlg.transcript.length}`;

    // Audio Link
    const voiceControl = document.getElementById('voiceCallControl');
    if (dlg.audio_url) {
        voiceControl.classList.remove('hidden');
        document.getElementById('btnExternalAudio').href = dlg.audio_url;
    } else {
        voiceControl.classList.add('hidden');
    }

    // Evaluation data
    const evalData = dlg.evaluation;
    const scorePill = document.getElementById('scoreHeaderPill');
    const severeAlert = document.getElementById('severeAlertBadge');
    const noEvalNotice = document.getElementById('noEvaluationNotice');
    const evalCard = document.getElementById('evaluationCard');
    const metaSpan = document.getElementById('activeEvalMeta');

    if (evalData) {
        scorePill.classList.remove('hidden');
        document.getElementById('activeTotalScore').innerText = evalData.total_score.toFixed(2);
        
        // Chess Rating Badge in Header
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

        metaSpan.classList.remove('hidden');
        metaSpan.innerText = `· Задержка: ${evalData.latency_ms}мс · Расход: $${evalData.cost_usd.toFixed(4)}`;

        noEvalNotice.classList.add('hidden');
        evalCard.classList.remove('hidden');

        renderSectionScores(evalData.section_scores);
        renderMonolithicCriteria(evalData.criteria_results);
        document.getElementById('evalSummaryFeedback').innerText = evalData.summary_feedback || 'Оценка завершена в штатном режиме.';
    } else {
        scorePill.classList.add('hidden');
        severeAlert.classList.add('hidden');
        metaSpan.classList.add('hidden');
        noEvalNotice.classList.remove('hidden');
        evalCard.classList.add('hidden');
    }

    renderTranscript();
    renderAppealsList();
}

function renderSectionScores(sections) {
    const container = document.getElementById('sectionScoresContainer');
    if (!sections || Object.keys(sections).length === 0) {
        container.innerHTML = '';
        return;
    }

    const sectionLabels = {
        'НАЧАЛО И ПОНИМАНИЕ ЗАПРОСА': '1. Начало и запрос',
        'БЕЗОПАСНОСТЬ И РЕШЕНИЕ': '2. Безопасность и решение',
        'ВЕДЕНИЕ И ЗАВЕРШЕНИЕ ДИАЛОГА': '3. Ведение и завершение'
    };

    container.innerHTML = Object.entries(sections).map(([name, val]) => {
        const shortName = sectionLabels[name] || name;
        const pct = val.max > 0 ? Math.round((val.earned / val.max) * 100) : 0;

        return `
            <div class="bg-white p-2.5 rounded border border-[#cbd5e1] shadow-2xs">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-bold text-slate-700 uppercase tracking-tight truncate">${shortName}</span>
                    <span class="text-xs font-mono font-bold text-slate-900">${val.earned} / ${val.max} б</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                    <div class="bg-[#00965e] h-1 transition-all duration-300" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderMonolithicCriteria(criteriaResults) {
    const container = document.getElementById('criteriaMonolithicContainer');
    if (!criteriaResults) {
        container.innerHTML = '';
        return;
    }

    const rows = Object.values(criteriaResults).sort((a, b) => (a.code || '').localeCompare(b.code || ''));

    container.innerHTML = rows.map(item => {
        const isNA = item.is_na || item.status === 'NA';
        const badgeKey = item.chess_badge;
        const iconInfo = (!isNA && badgeKey) ? getChessIconInfo(badgeKey) : null;

        // Clean Chess Badge or N/A Badge (NO Forced!)
        let chessBadgeHtml = '';
        if (isNA) {
            chessBadgeHtml = `
                <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 bg-slate-100 text-slate-700 font-bold text-[10px]">
                    <span>N/A</span>
                    <span class="font-normal text-slate-500 text-[9px]">(не требуется)</span>
                </div>
            `;
        } else if (iconInfo) {
            chessBadgeHtml = `
                <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border ${iconInfo.badgeClass} font-bold text-[11px]" title="${iconInfo.label}">
                    <img src="/assets/rating icons/${iconInfo.file}" alt="${badgeKey}" class="chess-icon-sm">
                    <span>${iconInfo.label}</span>
                </div>
            `;
        } else {
            chessBadgeHtml = `<span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">${item.status}</span>`;
        }

        // Score display
        let scoreDisplay = '';
        if (isNA) {
            scoreDisplay = `
                <div class="text-right">
                    <span class="font-mono font-bold text-slate-400 text-xs">—</span>
                    <div class="text-[10px] text-slate-400">вес перераспределен</div>
                </div>
            `;
        } else {
            scoreDisplay = `
                <div class="text-right">
                    <span class="font-mono font-bold text-slate-900 text-xs">${item.final_score.toFixed(2)}</span>
                    <span class="text-slate-400 font-mono text-[11px]">/ ${item.redistributed_weight.toFixed(2)} б</span>
                    <div class="text-[10px] text-slate-400 font-mono">(баз. вес: ${item.base_weight})</div>
                </div>
            `;
        }

        const isDisputed = state.activeDialogue && state.activeDialogue.appeals && 
            state.activeDialogue.appeals.some(a => a.criterion_id === item.criterion_id && a.status === 'pending');

        const disputeAction = isDisputed 
            ? '<span class="text-[10px] text-amber-700 font-semibold flex items-center gap-1 shrink-0"><i class="fa-solid fa-clock"></i> В апелляции</span>'
            : `<button onclick="window.openAppealModal('${item.criterion_id}')" class="px-2 py-1 text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-[#cbd5e1] transition shrink-0">Оспорить</button>`;

        // Integrated Quote block directly below the criterion
        let quoteHtml = '';
        if (item.quote) {
            const cleanQuoteForCall = item.quote.replace(/'/g, "\\'");
            quoteHtml = `
                <div onclick="window.jumpToQuote('${item.quote_timestamp}', '${cleanQuoteForCall}')" 
                    class="mt-1.5 p-2 bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 rounded cursor-pointer transition flex items-start gap-2 text-[11px] text-slate-800"
                    title="Кликните для перехода к фразе в транскрипте">
                    <i class="fa-solid fa-quote-left text-[#00965e] mt-0.5 shrink-0 text-xs"></i>
                    <div class="min-w-0 flex-1">
                        <span class="font-mono font-bold text-emerald-800 mr-1">[${item.quote_timestamp || '—'}]</span>
                        <span class="italic font-medium">"${item.quote}"</span>
                    </div>
                    <span class="text-[10px] text-emerald-700 font-semibold shrink-0 ml-2">Перейти ↵</span>
                </div>
            `;
        }

        return `
            <div class="p-3 hover:bg-slate-50/60 transition">
                <!-- Top Row: Icon + Name + Score + Action -->
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2 min-w-0 flex-1">
                        <span class="font-mono font-bold text-slate-400 text-xs shrink-0">${item.code || '—'}</span>
                        <div class="shrink-0">
                            ${chessBadgeHtml}
                        </div>
                        <div class="min-w-0">
                            <span class="font-bold text-slate-900 text-xs">${item.name}</span>
                            <span class="text-[10px] text-slate-400 uppercase tracking-tight ml-1">• ${item.section}</span>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 shrink-0">
                        ${scoreDisplay}
                        ${disputeAction}
                    </div>
                </div>

                <!-- Bottom Block: Reasoning & Quote in-place -->
                <div class="mt-1.5 pl-6">
                    <div class="text-[11px] text-slate-600 leading-relaxed">${item.reasoning || '—'}</div>
                    ${quoteHtml}
                </div>
            </div>
        `;
    }).join('');
}

function renderTranscript() {
    const list = document.getElementById('transcriptMessagesList');
    const dlg = state.activeDialogue;
    if (!dlg || !dlg.transcript) {
        list.innerHTML = '<p class="text-center text-slate-400 text-xs py-6">Транскрипт пуст</p>';
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
            roleBadge = '<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Оператор</span>';
            bubbleClass = 'bg-white border-l-3 border-l-[#00965e] border-slate-200';
            alignClass = 'ml-6';
        } else if (isClient) {
            roleBadge = '<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Клиент</span>';
            bubbleClass = 'bg-blue-50/40 border-l-3 border-l-blue-500 border-slate-200';
            alignClass = 'mr-6';
        } else if (isBot) {
            roleBadge = '<span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">AI-Бот</span>';
            bubbleClass = 'bg-slate-50 border border-slate-200';
            alignClass = 'mx-4';
        } else {
            roleBadge = '<span class="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-200 text-slate-600">Система</span>';
            bubbleClass = 'bg-slate-100 border border-slate-200 text-slate-500 italic text-[11px]';
            alignClass = 'mx-6';
        }

        return `
            <div id="transcript-msg-${idx}" data-ts="${msg.timestamp}" data-text="${encodeURIComponent(msg.text)}" 
                class="p-2.5 rounded border transition shadow-2xs text-xs ${bubbleClass} ${alignClass}">
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-1.5">
                        ${roleBadge}
                        <span class="font-mono text-[10px] text-slate-400">${msg.timestamp}</span>
                    </div>
                </div>
                <div class="text-slate-800 leading-relaxed">
                    ${msg.text}
                </div>
            </div>
        `;
    }).join('');
}

function renderAppealsList() {
    const container = document.getElementById('dialogueAppealsList');
    const badge = document.getElementById('tabAppealsBadge');
    const dlg = state.activeDialogue;
    if (!dlg || !dlg.appeals || dlg.appeals.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center text-slate-400 text-xs">
                <i class="fa-solid fa-scale-balanced text-xl text-slate-300 mb-1"></i>
                <p>По данному диалогу апелляций пока нет.</p>
            </div>
        `;
        badge.classList.add('hidden');
        return;
    }

    badge.innerText = dlg.appeals.length;
    badge.classList.remove('hidden');

    container.innerHTML = dlg.appeals.map(a => {
        const isPending = a.status === 'pending';
        const isApproved = a.status === 'approved';
        
        let statusBadge = '';
        if (isPending) {
            statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">На рассмотрении</span>';
        } else if (isApproved) {
            statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">Одобрено</span>';
        } else {
            statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300">Отклонено</span>';
        }

        let resolutionBlock = '';
        if (!isPending) {
            resolutionBlock = `
                <div class="mt-2 pt-2 border-t border-slate-200 text-xs">
                    <div class="font-semibold text-slate-700">Решение супервизора:</div>
                    <div class="text-slate-600 italic">"${a.supervisor_comment || 'Без комментария'}"</div>
                    <div class="text-[11px] text-slate-400 mt-0.5">Итоговый балл: <strong>${a.resolved_score}</strong> (${a.resolved_at || ''})</div>
                </div>
            `;
        }

        return `
            <div class="p-2.5 bg-slate-50 rounded border border-[#cbd5e1] text-xs space-y-1">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-slate-800">Критерий: ${a.criterion_id}</span>
                    ${statusBadge}
                </div>
                <div class="text-slate-600">
                    Оценка AI: <strong>${a.original_score}</strong> → Запрос оператора: <strong class="text-amber-700">${a.proposed_score}</strong>
                </div>
                <div class="text-slate-700 italic bg-white p-2 rounded border border-slate-200">
                    "${a.operator_comment}"
                </div>
                ${resolutionBlock}
            </div>
        `;
    }).join('');
}

// ----------------- Tab Navigation ----------------- //

window.switchTab = function(tabName) {
    state.activeTab = tabName;
    ['score', 'transcript', 'appeals'].forEach(t => {
        const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const content = document.getElementById(`tabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (t === tabName) {
            btn.className = 'px-3 py-1 font-semibold rounded bg-white text-slate-900 shadow-2xs transition';
            content.classList.remove('hidden');
        } else {
            btn.className = 'px-3 py-1 font-medium rounded text-slate-600 hover:text-slate-900 transition';
            content.classList.add('hidden');
        }
    });
};

window.jumpToQuote = function(timestamp, quoteText) {
    window.switchTab('transcript');

    setTimeout(() => {
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
    }, 100);
};

window.openModal = function(id) {
    document.getElementById(id).classList.remove('hidden');
};

window.closeModal = function(id) {
    document.getElementById(id).classList.add('hidden');
};

// ----------------- Appeals Logic ----------------- //

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

    const payload = {
        conversation_id: dlg.conversation_id,
        criterion_id: document.getElementById('appealCriterionSelect').value,
        proposed_score: parseFloat(document.getElementById('appealProposedScore').value),
        operator_comment: document.getElementById('appealOperatorComment').value
    };

    try {
        const res = await fetch('/api/appeals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeModal('modalAppeal');
            await loadDialogue(dlg.conversation_id);
            await refreshAnalytics();
            window.switchTab('appeals');
        } else {
            const err = await res.json();
            alert(`Ошибка: ${err.detail || 'Не удалось отправить апелляцию'}`);
        }
    } catch (e) {
        console.error('Failed to submit appeal:', e);
    }
};

window.openSupervisorModal = async function() {
    try {
        const res = await fetch('/api/appeals/pending');
        const appeals = await res.json();
        const container = document.getElementById('supervisorAppealsList');

        if (appeals.length === 0) {
            container.innerHTML = `
                <div class="p-6 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-check text-xl text-emerald-500 mb-1"></i>
                    <p>Все апелляции рассмотрены! Нет ожидающих обращений.</p>
                </div>
            `;
        } else {
            container.innerHTML = appeals.map(a => `
                <div class="p-3 bg-slate-50 rounded border border-[#cbd5e1] space-y-2">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1.5">
                            <span class="font-bold text-slate-900 font-mono">${a.conversation_id}</span>
                            <span class="px-1 py-0.2 rounded text-[10px] font-bold bg-slate-200 text-slate-700">${a.language}</span>
                            <span class="px-1 py-0.2 rounded text-[10px] font-semibold bg-slate-200 text-slate-600">${a.channel}</span>
                        </div>
                        <span class="font-bold text-amber-800 font-mono text-[11px]">Критерий: ${a.criterion_id}</span>
                    </div>

                    <div class="grid grid-cols-2 gap-2 bg-white p-2 rounded border border-slate-200 text-xs">
                        <div>Исходный балл AI: <strong class="font-mono">${a.original_score}</strong></div>
                        <div>Запрашиваемый балл: <strong class="font-mono text-[#00965e]">${a.proposed_score}</strong></div>
                    </div>

                    <div class="text-slate-700 italic bg-amber-50/50 p-2 rounded border border-amber-200/60 text-xs">
                        "${a.operator_comment}"
                    </div>

                    <div class="flex items-center gap-2 pt-1">
                        <input type="text" id="supComment-${a.id}" placeholder="Комментарий супервизора..." 
                            class="flex-1 py-1 px-2 bg-white border border-[#cbd5e1] rounded text-xs">
                        <button onclick="window.resolveSupervisorAppeal(${a.id}, 'approved')" 
                            class="px-3 py-1 bg-[#00965e] hover:bg-[#007f50] text-white font-medium rounded text-xs transition">
                            Одобрить
                        </button>
                        <button onclick="window.resolveSupervisorAppeal(${a.id}, 'rejected')" 
                            class="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded text-xs transition">
                            Отклонить
                        </button>
                    </div>
                </div>
            `).join('');
        }

        openModal('modalSupervisor');
    } catch (e) {
        console.error('Failed to load pending appeals:', e);
    }
};

window.resolveSupervisorAppeal = async function(appealId, status) {
    const commentInput = document.getElementById(`supComment-${appealId}`);
    const supervisorComment = commentInput ? commentInput.value.trim() : '';

    try {
        const res = await fetch(`/api/appeals/${appealId}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: status,
                supervisor_comment: supervisorComment || (status === 'approved' ? 'Одобрено супервизором' : 'Отклонено')
            })
        });

        if (res.ok) {
            await window.openSupervisorModal();
            if (state.activeDialogue) {
                await loadDialogue(state.activeDialogue.conversation_id);
            }
            await refreshAnalytics();
        } else {
            alert('Не удалось сохранить решение супервизора.');
        }
    } catch (e) {
        console.error('Failed to resolve appeal:', e);
    }
};

// ----------------- Dynamic Checklist Editor ----------------- //

window.openChecklistModal = function() {
    if (!state.checklist) return;
    renderChecklistEditor();
    openModal('modalChecklist');
};

function renderChecklistEditor() {
    const container = document.getElementById('checklistEditorContainer');
    const chk = state.checklist;

    container.innerHTML = chk.criteria.map((c, idx) => `
        <div class="p-2.5 bg-slate-50 rounded border border-[#cbd5e1] space-y-1.5" data-crit-index="${idx}">
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 flex-1">
                    <input type="text" class="crit-code w-12 py-0.5 px-1.5 border border-slate-300 rounded font-mono font-bold text-xs" value="${c.code}">
                    <input type="text" class="crit-name flex-1 py-0.5 px-1.5 border border-slate-300 rounded font-bold text-xs" value="${c.name}">
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-[11px] text-slate-500">Вес:</label>
                    <input type="number" class="crit-weight w-14 py-0.5 px-1.5 border border-slate-300 rounded font-mono text-xs" value="${c.weight}">
                    <button onclick="window.removeCriterionRow(${idx})" class="text-rose-500 hover:text-rose-700 p-1" title="Удалить">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <input type="text" class="crit-section py-0.5 px-1.5 border border-slate-300 rounded text-slate-600 text-xs" value="${c.section}">
                <div class="flex items-center gap-2">
                    <label class="flex items-center gap-1.5 cursor-pointer text-slate-700 text-xs">
                        <input type="checkbox" class="crit-allow-na" ${c.allow_na ? 'checked' : ''}>
                        <span>Разрешен N/A</span>
                    </label>
                </div>
            </div>
            <textarea class="crit-desc w-full py-0.5 px-1.5 border border-slate-300 rounded text-slate-600 text-xs" rows="2">${c.description}</textarea>
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
        description: "Да — условие выполнено. Нет — условие не выполнено. N/A — не применимо.",
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
