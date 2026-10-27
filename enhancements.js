/* Sales and payment upgrades for the Mokato Capacitor app. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const money = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US');
  const today = () => new Date().toISOString().slice(0, 10);
  const timeNow = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const paymentLabel = (r) => r.py || ((Number(r.pd) || 0) < tot(r).total ? 'credit' : 'cash');
  const totalNow = () => {
    const subtotal = items().reduce((sum, item) => sum + item.q * item.p, 0);
    return Math.max(subtotal - (parseFloat($('ds').value) || 0), 0);
  };
  const payWrap = document.createElement('div');
  payWrap.innerHTML = '<label for="mokato-payment">طريقة الدفع</label><select id="mokato-payment"><option value="cash">نقدي</option><option value="credit">آجل</option></select><div id="mokato-payment-help" class="mu" style="margin:-4px 0 8px">النقدي يُسجل مدفوعًا بالكامل. الآجل يقبل دفعة جزئية.</div>';
  $('pd').parentElement.before(payWrap);
  const method = $('mokato-payment');
  const paidLabel = document.querySelector('label[for="pd"]');
  paidLabel.textContent = 'المدفوع (ج.م)';
  const baseReceipt = receipt;
  receipt = function (r) {
    let html = baseReceipt(r);
    const mode = r.py || method.value || paymentLabel(r);
    const due = tot(r).rem;
    const line = '<div class="meta"><span>طريقة الدفع</span><b>' + (mode === 'credit' ? 'آجل' : 'نقدي') + '</b></div>' +
      '<div class="meta"><span>' + (due > 0 ? 'المتبقي على العميل' : 'حالة الفاتورة') + '</span><b>' + (due > 0 ? money(due) + ' ج.م' : 'مدفوعة بالكامل') + '</b></div>';
    return html.replace('<div class="dash"></div><div class="c" style="font-weight:800">شكرًا', line + '<div class="dash"></div><div class="c" style="font-weight:800">شكرًا');
  };
  const baseDraw = draw;
  draw = function () {
    if (method.value === 'cash') $('pd').value = money(totalNow()).replace(/,/g, '');
    $('pd').disabled = method.value === 'cash' || edit !== null;
    paidLabel.textContent = edit !== null ? 'إجمالي ما تم تحصيله (ج.م)' : method.value === 'credit' ? 'الدفعة المقدمة (ج.م)' : 'المدفوع (ج.م)';
    $('mokato-payment-help').textContent = edit !== null ? 'لتسجيل تحصيل جديد استخدم زر «تحصيل دفعة» من قائمة الفواتير.' : method.value === 'credit' ? 'سجّل الدفعة المقدمة إن وجدت، ثم أضف التحصيلات لاحقًا من قائمة الفواتير.' : 'النقدي يُسجل مدفوعًا بالكامل.';
    baseDraw();
  };
  const baseNewForm = newForm;
  newForm = function () { method.value = 'cash'; baseNewForm(); draw(); };
  const baseLoadInv = loadInv;
  loadInv = function (r) { method.value = paymentLabel(r); baseLoadInv(r); draw(); };
  method.addEventListener('change', () => {
    if (method.value === 'cash') $('pd').value = totalNow();
    else if (edit === null) $('pd').value = 0;
    draw();
  });

  const baseList = list;
  list = function () {
    baseList();
    document.querySelectorAll('#list .it').forEach((row) => {
      const editButton = row.querySelector('[data-e]');
      if (!editButton) return;
      const invoice = INV.find((item) => item.no == editButton.dataset.e);
      if (!invoice || tot(invoice).rem <= 0) return;
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.collect = invoice.no; button.textContent = 'تحصيل دفعة';
      row.appendChild(button);
    });
  };
  $('list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-collect]');
    if (!button) return;
    const invoice = INV.find((item) => item.no == button.dataset.collect);
    if (!invoice) return;
    const due = tot(invoice).rem;
    const value = prompt('المتبقي على العميل ' + money(due) + ' ج.م. اكتب قيمة الدفعة:');
    if (value === null) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0 || amount > due) { alert('اكتب مبلغًا أكبر من صفر ولا يزيد عن المتبقي.'); return; }
    invoice.pd = (Number(invoice.pd) || 0) + amount;
    invoice.py = 'credit';
    invoice.paylog = Array.isArray(invoice.paylog) ? invoice.paylog : [];
    invoice.paylog.push({ date: today(), time: timeNow(), amount });
    save(); list();
    alert('تم تسجيل الدفعة. المتبقي الآن ' + money(tot(invoice).rem) + ' ج.م.');
  });

  const baseRep = rep;
  rep = function () {
    baseRep();
    const period = $('per').value;
    const periodInvoices = INV.filter((r) => period === 'all' || (period === 'd' && r.dt === today()) || (period === 'm' && (r.dt || '').slice(0, 7) === today().slice(0, 7)));
    const received = periodInvoices.reduce((sum, r) => sum + (Number(r.pd) || 0), 0);
    const dueInvoices = INV.map((r) => ({ r, due: tot(r).rem })).filter((entry) => entry.due > 0);
    const customerBalances = {};
    dueInvoices.forEach(({ r, due }) => {
      const key = (r.cp || '') + '|' + (r.cn || 'بدون اسم');
      const row = customerBalances[key] || (customerBalances[key] = { name: r.cn || 'بدون اسم', phone: r.cp || '', due: 0, count: 0 });
      row.due += due; row.count += 1;
    });
    const balances = Object.values(customerBalances).sort((a, b) => b.due - a.due);
    const debtRows = balances.map((r) => '<tr><td>' + esc(r.name) + (r.phone ? '<div class="mu">' + esc(r.phone) + '</div>' : '') + '</td><td>' + r.count + '</td><td>' + money(r.due) + ' ج.م</td></tr>').join('') || '<tr><td colspan="3" class="mu">لا توجد مبالغ آجلة مستحقة</td></tr>';
    $('repo').insertAdjacentHTML('beforeend', '<h2>التحصيل والآجل</h2><div class="st"><div><span>المحصل على فواتير الفترة</span><b>' + money(received) + ' ج.م</b></div><div><span>المستحق على فواتير الفترة</span><b>' + money(periodInvoices.reduce((sum, r) => sum + Math.max(tot(r).rem, 0), 0)) + ' ج.م</b></div></div><div class="box"><h2 style="margin-top:0">أرصدة العملاء الآجلة الحالية</h2><table class="t"><tr><th>العميل</th><th>فواتير</th><th>المتبقي</th></tr>' + debtRows + '</table></div>');
  };

  $('make').onclick = async () => {
    const r = formRec();
    if (!r.it.length) { alert('أضف صنفًا واحدًا على الأقل.'); return; }
    const total = tot(r).total;
    if (method.value === 'cash') r.pd = total;
    const paid = Number(r.pd) || 0;
    if (paid < 0 || paid > total) { alert('قيمة المدفوع لا يمكن أن تكون أكبر من إجمالي الفاتورة.'); return; }
    r.py = method.value;
    const previous = INV.find((item) => item.no === r.no);
    r.paylog = Array.isArray(previous?.paylog) ? previous.paylog.slice() : [];
    const oldPaid = Number(previous?.pd) || 0;
    if (paid > oldPaid) r.paylog.push({ date: today(), time: timeNow(), amount: paid - oldPaid });
    if (edit === null) { INV.unshift(r); CNT = r.no; edit = r.no; }
    else { const index = INV.findIndex((item) => item.no === r.no); if (index >= 0) INV[index] = r; else INV.unshift(r); }
    editTm = r.tm; save(); draw(); await snap(r);
  };
  const nativeShare = async (fileName, blob, title, text) => {
    const native = window.MokatoNative;
    if (native && native.Capacitor.isNativePlatform()) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
      });
      const result = await native.Filesystem.writeFile({ path: 'mokato/' + fileName, data: String(dataUrl).split(',')[1], directory: native.Directory.Cache, recursive: true });
      await native.Share.share({ title, text, files: [result.uri], dialogTitle: 'مشاركة أو حفظ الملف' });
      return true;
    }
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: blob.type })] })) {
      await navigator.share({ title, text, files: [new File([blob], fileName, { type: blob.type })] }); return true;
    }
    return false;
  };
  const fallbackDownload = (fileName, blob) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  };
  $('sv').onclick = async () => {
    const message = $('msg'); message.textContent = '';
    try {
      const fileName = 'invoice-' + $('out').dataset.no + '.png';
      if (await nativeShare(fileName, blob, 'فاتورة مبيعات موكاتو', 'فاتورة رقم ' + $('out').dataset.no)) { message.textContent = 'اختار WhatsApp للإرسال أو تطبيقًا مناسبًا للحفظ.'; return; }
      fallbackDownload(fileName, blob); message.textContent = 'تم تجهيز الصورة. لو لم تظهر في التنزيلات، اضغط مطولًا عليها واختر حفظ الصورة.';
    } catch (error) { message.textContent = 'تعذر فتح المشاركة. اضغط مطولًا على الصورة لحفظها.'; }
  };
  $('sh').onclick = async () => {
    const message = $('msg'); message.textContent = '';
    try {
      const fileName = 'invoice-' + $('out').dataset.no + '.png';
      if (!(await nativeShare(fileName, blob, 'فاتورة مبيعات موكاتو', 'فاتورة رقم ' + $('out').dataset.no))) { message.textContent = 'المشاركة غير مدعومة في هذا المتصفح؛ استخدم زر حفظ الصورة.'; }
    } catch (error) { message.textContent = 'تعذر فتح قائمة المشاركة. جرب حفظ الصورة أولًا.'; }
  };
  $('bj').onclick = async () => {
    const data = new Blob([JSON.stringify({ P, PK, INV, CNT }, null, 2)], { type: 'application/json;charset=utf-8' });
    try { if (await nativeShare('mokato-backup-' + today() + '.json', data, 'نسخة مبيعات موكاتو', 'نسخة احتياطية للفواتير')) return; } catch (error) {}
    fallbackDownload('mokato-backup-' + today() + '.json', data);
  };
  $('bc').onclick = async () => {
    const quote = (value) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const lines = [['رقم الفاتورة','التاريخ','العميل','الهاتف','طريقة الدفع','الإجمالي','المدفوع','المتبقي','التكلفة','الربح'].join(',')];
    INV.forEach((r) => { const x = tot(r); lines.push([r.no, r.dt, quote(r.cn), quote(r.cp), paymentLabel(r) === 'credit' ? 'آجل' : 'نقدي', x.total, Number(r.pd)||0, Math.max(x.rem,0), x.cost, x.profit].join(',')); });
    const data = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    try { if (await nativeShare('mokato-sales-' + today() + '.csv', data, 'تقرير مبيعات موكاتو', 'تصدير الفواتير')) return; } catch (error) {}
    fallbackDownload('mokato-sales-' + today() + '.csv', data);
  };
  $('sv').textContent = 'حفظ / مشاركة الصورة';
  $('sh').textContent = 'مشاركة مع التطبيقات';
  $('pd').addEventListener('input', () => { if (method.value === 'credit') draw(); });
  draw();
})();
