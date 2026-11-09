# تِلاد

منصة عرض أراضي القادسية والأمل في العبور الجديدة. "العقار قرارٌ لا صفقةٌ".

- `/` الصفحة العامة: التقسيم، وأرقام الأحياء، وكروت القطع (السعر الكلي، والمطلوب دفعه، والمتبقي، والأقساط)، والفلاتر، والمقارنة، واطلب القطعة، وواتساب، و"اعرض قطعتك" في صفحتين.
- `/admin` لوحة الإدارة: موافقة ونشر الإعلانات (بيتولد كود وحدة ثابت)، والرفض، واتباعت، والإخفاء، والطلبات.

## التشغيل

```bash
npm install
npm run dev
```

## Supabase

- المشروع: `xvxwvkxashwizafetltl` (Frankfurt). الـ SQL في `supabase/migrations`.
- الزوار مش بيكتبوا في الجداول مباشرة. فيه دالتين بس متاحين: `submit_offer` و`submit_request`، وعليهم حد أقصى للعدد.
- اسم صاحب القطعة وتليفونه ورقم القطعة في `listing_private`، ومحدش بيشوفهم غير الأدمن.
- `remaining` (المتبقي) بيتحسب في الداتابيز: السعر الكلي − المطلوب دفعه.

### إضافة أدمن

الدخول على `/admin` برقم الموبايل والباسورد. الرقم بيتحفظ في Supabase على شكل إيميل داخلي: `01xxxxxxxxx@admin.telad.app`.

1. من Supabase: Authentication ← Users ← Add user ← Create new user. الإيميل `رقمك@admin.telad.app` (مثلاً `01024151524@admin.telad.app`)، وباسورد، وعلّم على Auto Confirm User.
2. من SQL Editor:

```sql
insert into public.admins (user_id) select id from auth.users where email = '01024151524@admin.telad.app';
```

متغيرات البيئة (اختيارية، فيه قيم افتراضية عامة في `lib/supabase.js`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

واتساب تِلاد: 01024151524 (في `lib/market-ui.js`).
