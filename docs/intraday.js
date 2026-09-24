/* Display sanitized snapshots. All trading calculations run privately. */
(() => {
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? "—").replace(/[&<>"']/g, c =>
    ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const number = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : "—";
  const percent = value => Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value.toFixed(3)}%` : "—";
  const localTime = value => {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "—" : new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit",
      minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).format(date);
  };
  let payload;
  let fetchFailed = false;
  let fetching = false;
  let lastFetchAt = 0;

  function render(data) {
    const plan = data.plan || {};
    const snap = data.latest;
    const now = Date.now();
    const scheduled = Date.parse(plan.scheduled_at);
    const end = Date.parse(`${plan.target_date}T15:00:00+08:00`);
    const expiredPlan = Number.isFinite(end) && now >= end;
    const current = snap?.date === plan.target_date;
    const expired = !!snap && now >= Date.parse(snap.valid_until);
    const stale = !!snap && !expired && now - Date.parse(snap.captured_at) > 180000;
    const active = current && snap?.status === "ready" && !expired && !stale && !fetchFailed;
    el("intradayPlan").textContent = plan.enabled
      ? `${plan.target_date} 14:50（上海）已安排 · ${plan.reasons.join("；")}。收盘前约每3分钟更新。`
      : plan.status === "blocked" ? `计划待补齐：${plan.reason || "历史数据或日历不足"}`
        : `${plan.target_date || "下一交易日"} 暂无候选交易安排；每次晚间更新后重新检查。`;
    el("intradayState").textContent = fetchFailed ? "更新暂不可用" : active ? "盘中预估"
      : current && snap?.status === "unavailable" ? "数据待确认"
        : stale && current ? "快照已过期，等待更新"
          : expiredPlan ? "本轮已结束"
            : plan.enabled && now >= scheduled ? "等待当日快照"
              : plan.enabled ? "已自动启用" : "未启用";
    el("intradayQuotesWrap").hidden = !snap?.quotes?.length;
    el("intradayQuotes").innerHTML = (snap?.quotes || []).map(q => `<tr>
      <td>${escape(q.name)}</td><td>${number(q.price, q.key === "etf159531" ? 3 : 2)}</td>
      <td>${percent(q.change_pct)}</td><td>${escape(localTime(q.quoted_at))}</td><td>${escape(q.source)}</td>
    </tr>`).join("");
    if (!snap) {
      el("intradaySummary").textContent = expiredPlan
        ? "本轮未取得可展示的盘中快照，请检查运行状态；收盘后不补发盘中交易判断。"
        : "等待候选日快照。届时展示交易判断，以及收盘涨到或跌到何处会改变结论。";
      el("intradayTime").textContent = "";
      el("intradayThresholds").replaceChildren();
      el("intradayNotes").textContent = "Mac需保持开机、联网并登录；报价缺失或过期时显示待确认。";
      return;
    }
    const prefix = active ? "收盘近似判断：" : "最近快照记录（不作为当前指令）：";
    el("intradaySummary").textContent = prefix + snap.summary;
    el("intradayTime").textContent = `快照采集于 ${localTime(snap.captured_at)} · 正式收盘前的估算`
      + (Number.isFinite(snap.predicted_gap_pct)
        ? ` · 间断预测 ${percent(snap.predicted_gap_pct)}，参与门槛 > ${percent(snap.prediction_threshold_pct)}` : "");
    const thresholds = snap.thresholds || [];
    el("intradayThresholds").innerHTML = thresholds.length ? `
      <h3>什么收盘价会改变结论</h3>
      <p class="section-kicker">${escape(snap.assumption)} 边界价显示至4位小数，判断使用未舍入值。</p>
      <div class="table-scroll"><table>
        <thead><tr><th>标的 / 条件</th><th>收盘边界价</th><th>较昨收</th><th>较快照还需涨跌</th><th>低于边界</th><th>等于边界</th><th>高于边界</th></tr></thead>
        <tbody>${thresholds.map(t => `<tr><td>${escape(t.name)}<br>${escape(t.label)}</td>
          <td>${number(t.price, 4)}</td><td>${percent(t.change_pct)}</td><td>${percent(t.from_snapshot_pct)}</td>
          <td>${escape(t.below)}</td><td>${escape(t.at)}</td><td>${escape(t.above)}</td></tr>`).join("")}</tbody>
      </table></div>` : `<p>${escape(snap.threshold_note || "有效数据不足，暂不计算决策变更阈值。")}</p>`;
    let notes = [...(snap.issues || []), snap.position_note || ""];
    const confirmation = snap.close_confirmation;
    if (confirmation) {
      const action = {TRADE: "参与", NO_TRADE: "不参与", WAIT: "待确认"}[confirmation.action] || "待确认";
      notes.push(`${confirmation.label}：${action}${confirmation.changed === true ? "，与盘中原始间断预估不同" : ""}。`);
    }
    if (expired || stale) notes.unshift("该快照已过有效时段，仅供回看。");
    el("intradayNotes").textContent = notes.filter(Boolean).join(" ");
  }

  async function refresh() {
    if (fetching) return;
    fetching = true;
    lastFetchAt = Date.now();
    try {
      const response = await fetch("data/intraday.json", {cache: "no-store", signal: AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await response.json();
      fetchFailed = false;
      render(payload);
    } catch {
      fetchFailed = true;
      if (payload) render(payload);
      el("intradayState").textContent = "更新暂不可用";
      el("intradaySummary").textContent = "盘中观察更新暂不可用，当前交易判断待确认。";
    } finally {
      fetching = false;
    }
  }
  refresh();
  // Poll during the candidate window; continue updating expiry without reload.
  setInterval(() => {
    if (payload) render(payload);
    const scheduled = Date.parse(payload?.plan?.scheduled_at);
    const end = Date.parse(`${payload?.plan?.target_date}T15:01:00+08:00`);
    if (!document.hidden && (!payload || Date.now() - lastFetchAt >= 300000 ||
        (Date.now() >= scheduled && Date.now() < end))) refresh();
  }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
})();
