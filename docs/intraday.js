/* Display sanitized assessments; strategy calculations stay in the private runner. */
(() => {
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? "—").replace(/[&<>"']/g, c =>
    ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const number = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : "—";
  const percent = value => Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value.toFixed(3)}%` : "—";
  const localTime = value => {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "—" : new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).format(date);
  };
  let payload;
  let fetchFailed = false;
  let fetching = false;
  let lastFetchAt = 0;

  function card(prefix, status, tone, scope, reasons, execution) {
    if (prefix === "mainStrategy") {
      el("mainStrategyDetails").hidden = true;
      el("mainStrategyConditions").replaceChildren();
    }
    el(`${prefix}Status`).textContent = status;
    el(`${prefix}Status`).className = `strategy-status tone-${tone}`;
    el(`${prefix}Scope`).textContent = scope;
    el(`${prefix}Reasons`).innerHTML = reasons.map(reason => `<li>${escape(reason)}</li>`).join("");
    el(`${prefix}Execution`).textContent = execution;
  }

  function renderStrategies(plan, snap, invalid, historical) {
    const scope = snap ? `${localTime(snap.captured_at)} · ${historical ? "历史快照，非当前指令" : "盘中预估，待收盘复核"}`
      : `观察日 ${plan.target_date || "待定"} · 尚无当日快照`;
    if (invalid || !snap || snap.status !== "ready") {
      const label = fetchFailed ? "更新中断，待确认" : invalid ? "数据过期，待确认"
        : snap ? "数据不足，待确认" : plan.status === "blocked" ? "计划待补齐" : "尚未检查";
      const reasons = fetchFailed ? ["未能取得最新观察记录；已有记录不能替代本次检查。"]
        : invalid ? ["报价已超过有效时段，等待新的有效快照。"]
          : snap?.issues?.length ? snap.issues : [plan.reason || "启用监控不等于信号触发；未取得快照前不判断是否参与。"];
      card("mainStrategy", label, "pending", scope, reasons, "等待有效数据。这里不推断已有主策略仓位的退出安排。");
      card("gapStrategy", label, "pending", scope, reasons, "等待有效数据；实际持仓需自行核对。");
      return;
    }

    const main = snap.main_assessment;
    const existing = {
      MAIN_ENTRY_OPEN: "已有主策略计划于该观察日开盘进场；盘中检查不代表再开一笔。",
      HOLD_MAIN: "已有主策略处于计划持有期。",
      EXIT_MAIN_CLOSE: "若实际持有对应主策略仓位，原计划于该观察日收盘退出。",
      EXIT_MAIN_OPEN: "原主策略计划于该观察日开盘退出；此快照不补发开盘操作。",
    }[snap.action];
    if (main) {
      const tone = main.overseas_status === "pending" && main.status === "not_triggered" ? "pending"
        : {triggered: "triggered", not_triggered: "neutral", blocked: "blocked", pending: "pending"}[main.status] || "pending";
      card("mainStrategy", main.label, tone,
        `${scope} · 趋势基准 ${main.history_as_of || "待确认"}`,
        main.highlights?.length ? main.highlights : [...(main.reasons || []), main.coverage].filter(Boolean),
        [existing, main.execution].filter(Boolean).join(" "));
      if (main.highlights?.length && main.reasons?.length) {
        el("mainStrategyDetails").hidden = false;
        el("mainStrategyConditions").innerHTML = [...main.reasons, main.coverage].filter(Boolean)
          .map(reason => `<li>${escape(reason)}</li>`).join("");
      }
    } else {
      const known = typeof snap.next_main_signal === "boolean";
      card("mainStrategy", known ? snap.next_main_signal ? "国内条件触发" : "未安排新的主策略开仓" : "主策略状态待确认",
        known ? snap.next_main_signal ? "triggered" : "neutral" : "pending", scope,
        ["该历史快照未记录原始条件明细；未安排开仓也可能由日历或已有仓位占用造成。"],
        existing || "需要正式收盘复核后，才能确认下一交易日的执行安排。");
    }

    let label = "今日无新开仓安排";
    let tone = "neutral";
    let reasons = ["该快照没有间断腿的新开仓判断。"];
    let execution = "不因这条状态新增间断仓。";
    if (snap.action === "EXIT_GAP_CLOSE") {
      label = "退出观察日 · 有仓才适用";
      reasons = ["这是休市后原定退出日，不是新的买入信号。", "系统没有记录您的实际持仓；页面出现退出安排不表示您持有间断仓。"];
      execution = "仅实际持有本轮间断仓时，原计划为该观察日收盘退出；未持有则无需执行这一退出安排。";
    } else if (["TRADE", "NO_TRADE", "COOLDOWN", "MAIN_PRIORITY"].includes(snap.action) || snap.raw_gap_action) {
      const raw = snap.raw_gap_action || (["TRADE", "NO_TRADE"].includes(snap.action) ? snap.action : null);
      label = raw === "TRADE" ? "原始信号达到参与门槛" : raw === "NO_TRADE" ? "原始信号未达参与门槛" : "新开仓受组合安排限制";
      tone = raw === "TRADE" ? "triggered" : "neutral";
      reasons = Number.isFinite(snap.predicted_gap_pct)
        ? [`间断预测 ${percent(snap.predicted_gap_pct)}；原始参与门槛为大于 ${percent(snap.prediction_threshold_pct)}。`]
        : ["原始间断信号与组合最终执行安排需要分别检查。"];
      execution = snap.action === "TRADE" ? "若收盘复核仍满足，可按该观察日计划参与本轮间断腿；执行前核对实际持仓。"
        : snap.action === "NO_TRADE" ? "该快照下不安排新开间断仓。"
          : snap.action === "COOLDOWN" ? "主策略退出后的两交易日冷却仍生效，本轮不新开间断仓。"
            : snap.action === "MAIN_PRIORITY" ? "主策略优先：预留次日开盘安排，本轮不新开间断仓。"
              : "已有主策略安排优先，本轮不新开间断仓。";
      if (!["TRADE", "NO_TRADE"].includes(snap.action)) {
        tone = "blocked";
        reasons.push("即使原始信号达标，组合占用与冷却仍可能阻止新开仓。");
      }
    } else if (existing) {
      label = "主策略安排优先";
      reasons = ["该观察日已有主策略进场、持有或退出安排。"];
      execution = "间断腿不因这次检查新增仓位；已有主策略的安排见主策略卡片。";
    } else {
      reasons = ["该观察日没有间断腿入场或退出安排；主策略的新信号独立检查。"];
    }
    card("gapStrategy", label, tone, scope, reasons, execution);
  }

  function render(data) {
    const plan = data.plan || {};
    const snap = data.latest;
    const now = Date.now();
    const scheduled = Date.parse(plan.scheduled_at);
    const end = Date.parse(`${plan.target_date}T15:00:00+08:00`);
    const expiredPlan = Number.isFinite(end) && now >= end;
    const current = snap?.date === plan.target_date;
    const captured = Date.parse(snap?.captured_at);
    const validUntil = Date.parse(snap?.valid_until);
    const expired = !!snap && Number.isFinite(validUntil) && now >= validUntil;
    const malformed = !!snap && (!Number.isFinite(captured) || !Number.isFinite(validUntil) || captured > now + 30000);
    const stale = !!snap && !expired && now - captured > 180000;
    const historical = !!snap && (expired || !current);
    const invalid = fetchFailed || malformed || (current && stale);
    const active = current && snap?.status === "ready" && !historical && !invalid;
    el("intradayPlan").textContent = plan.enabled
      ? `${plan.target_date} 14:50（上海）已安排。监控原因：${(plan.reasons || []).join("；")}。`
      : plan.status === "blocked" ? `计划待补齐：${plan.reason || "历史数据或日历不足"}`
        : `${plan.target_date || "下一交易日"} 未安排盘中抓取；晚间更新后重新检查候选条件。`;
    el("intradayState").textContent = fetchFailed ? "更新暂不可用" : active ? "盘中预估"
      : invalid ? "数据待更新" : historical ? "历史快照"
        : snap?.status === "unavailable" ? "数据待确认"
          : plan.status === "blocked" ? "计划待补齐" : expiredPlan ? "本轮已结束"
            : plan.enabled ? now >= scheduled ? "等待当日快照" : "监控已安排" : "未安排盘中抓取";
    el("intradaySummary").classList.toggle("historical", historical || invalid);
    el("intradaySummary").textContent = fetchFailed ? "最新记录读取失败，当前交易判断待确认。"
      : malformed ? "快照时间无效，当前判断待确认。"
        : stale && current ? "快照已超过3分钟有效期，等待更新；以下不提供新的执行判断。"
          : historical ? `以下为 ${snap.date} 的盘中快照记录，不是正式收盘确认或当前交易指令。${!current ? `下一观察日为 ${plan.target_date || "待定"}。` : ""}`
            : active ? "以下以盘中快照近似收盘：先看各策略是否触发，再看对应的执行安排。"
              : snap ? "关键数据尚不完整，待确认；缺少数据不代表策略未触发。"
                : "尚未取得本轮快照，不能判断是否触发；监控安排不等于交易信号。";
    el("intradayTime").textContent = snap ? `${localTime(snap.captured_at)} · 盘中快照` : "尚无快照";
    const formalAsOf = el("dailyReference").dataset.asOf;
    el("intradayFormal").textContent = formalAsOf
      ? `${formalAsOf}${snap && formalAsOf < snap.date ? ` · 尚未覆盖 ${snap.date}` : " · 与盘中快照分别记录"}`
      : "正式日线日期待确认";
    renderStrategies(plan, snap, invalid, historical);
    el("intradayQuotesWrap").hidden = !snap?.quotes?.length;
    el("intradayQuotes").innerHTML = (snap?.quotes || []).map(q => `<tr>
      <td>${escape(q.name)}</td><td>${number(q.price, q.key === "etf159531" ? 3 : 2)}</td>
      <td>${percent(q.change_pct)}</td><td>${escape(localTime(q.quoted_at))}</td><td>${escape(q.source)}</td>
    </tr>`).join("");
    const thresholds = !invalid && snap?.status === "ready" ? snap.thresholds || [] : [];
    el("intradayThresholds").innerHTML = thresholds.length ? `
      <h3>${historical ? "该次快照的执行安排变化边界" : "什么收盘价会改变执行安排"}</h3>
      <p class="section-kicker">${escape(snap.assumption)} 边界价显示至4位小数。</p>
      <div class="table-scroll"><table>
        <thead><tr><th>标的 / 条件</th><th>收盘边界价</th><th>较昨收</th><th>较快照还需涨跌</th><th>低于边界</th><th>等于边界</th><th>高于边界</th></tr></thead>
        <tbody>${thresholds.map(t => `<tr><td>${escape(t.name)}<br>${escape(t.label)}</td>
          <td>${number(t.price, 4)}</td><td>${percent(t.change_pct)}</td><td>${percent(t.from_snapshot_pct)}</td>
          <td>${escape(t.below)}</td><td>${escape(t.at)}</td><td>${escape(t.above)}</td></tr>`).join("")}</tbody>
      </table></div>` : `<p class="note">${escape(!invalid && snap?.status === "ready"
        ? historical ? "该次快照下，在其他条件固定时，没有会改变执行安排的单一价格边界。"
          : snap.threshold_note || "该快照没有可展示的单一价格变更边界。"
        : "等待有效数据后计算执行安排变化边界。")}</p>`;
    const notes = [...(snap?.issues || [])];
    if (snap?.close_confirmation) {
      const confirmation = snap.close_confirmation;
      const action = {TRADE: "参与", NO_TRADE: "不参与", WAIT: "待确认"}[confirmation.action] || "待确认";
      notes.push(`${confirmation.date} 间断腿原始信号的正式日线复核：${action}。此复核不代表主策略已确认。`);
    }
    el("intradayNotes").textContent = notes.join(" ");
  }

  async function refresh() {
    if (fetching) return;
    fetching = true;
    lastFetchAt = Date.now();
    try {
      const response = await fetch("data/intraday.json", {cache: "no-store", signal: AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const received = await response.json();
      if (!received || typeof received !== "object" || !received.plan || typeof received.plan !== "object") throw new Error("Invalid observation payload");
      payload = received;
      fetchFailed = false;
      render(payload);
    } catch {
      fetchFailed = true;
      render(payload || {plan: {}});
    } finally {
      fetching = false;
    }
  }
  refresh();
  window.addEventListener("dashboard-ready", () => { if (payload) render(payload); });
  setInterval(() => {
    if (payload) render(payload);
    const scheduled = Date.parse(payload?.plan?.scheduled_at);
    const end = Date.parse(`${payload?.plan?.target_date}T15:01:00+08:00`);
    if (!document.hidden && (!payload || Date.now() - lastFetchAt >= 300000 ||
        (Date.now() >= scheduled && Date.now() < end))) refresh();
  }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
})();
