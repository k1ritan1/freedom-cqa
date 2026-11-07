import React, { useState, useMemo } from 'react';

// ==========================================
// DESIGN TOKENS & TYPES
// ==========================================
interface AccordionItemData {
  id: number;
  categoryIds: string[];
  title: string;
  updateDate: string;
  voteStats?: string | null;
  content: React.ReactNode;
}

interface SidebarTab {
  id: string;
  title: string;
  iconType: 'star' | 'sheet';
}

// ==========================================
// PRESERVED ASSETS (EXACT INLINE SVG ICONS)
// ==========================================

export const BankLogo: React.FC<{ className?: string }> = ({ className = 'h-6' }) => (
  <div className={`flex items-center gap-2.5 select-none ${className}`}>
    <div className="w-8 h-8 rounded-lg bg-[#00BC58] flex items-center justify-center shadow-sm">
      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    </div>
    <div className="flex flex-col">
      <span className="font-bold text-sm tracking-tight text-[#F1F3F4] uppercase leading-none">Freedom</span>
      <span className="text-[10px] font-semibold text-[#7E8B99] tracking-wider uppercase leading-none mt-0.5">Bank</span>
    </div>
  </div>
);

export const PhoneIcon: React.FC = () => (
  <svg className="bvi-svg" fill="none" height="20" viewBox="0 0 28 28" width="20" xmlns="http://www.w3.org/2000/svg">
    <path d="m4.263 4.51 4.265-.985a.99.99 0 0 1 1.128.57l1.969 4.594a.98.98 0 0 1-.283 1.148l-2.485 2.035a15.2 15.2 0 0 0 7.267 7.267l2.035-2.485a.98.98 0 0 1 1.148-.283l4.594 1.969c.439.192.68.668.574 1.132l-.984 4.265a.984.984 0 0 1-.96.763C12.027 24.5 3.5 15.99 3.5 5.47c0-.46.316-.858.763-.96" fill="#00bc58" />
  </svg>
);

export const EyeIcon: React.FC = () => (
  <svg fill="none" height="18" width="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.5 9S4.227 3.75 9 3.75 16.5 9 16.5 9s-2.727 5.25-7.5 5.25S1.5 9 1.5 9" stroke="#707B88" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <path d="M9 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5" fill="#707B88" />
  </svg>
);

export const ChevronDownIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4 stroke-[#7E8B99]' }) => (
  <svg aria-hidden="true" className={className} fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const SunIcon: React.FC = () => (
  <svg className="w-5 h-5 fill-[#707B88]" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.013 1.629a.834.834 0 0 0-.833.833V4.13a.834.834 0 0 0 1.666 0V2.462a.834.834 0 0 0-.833-.833M4.701 3.816a.8.8 0 0 0-.573.261.824.824 0 0 0 0 1.172l1.12 1.146a.857.857 0 0 0 1.198 0 .857.857 0 0 0 0-1.199L5.3 4.077a.87.87 0 0 0-.6-.26m10.599.026a.78.78 0 0 0-.574.235l-1.146 1.12a.86.86 0 0 0 0 1.198.86.86 0 0 0 1.199 0l1.119-1.146a.824.824 0 0 0 0-1.172.84.84 0 0 0-.598-.235m-5.287 1.954a4.167 4.167 0 1 0 0 8.334 4.167 4.167 0 0 0 0-8.334m-7.5 3.333a.834.834 0 0 0 0 1.667H4.18a.834.834 0 0 0 0-1.667zm13.333 0a.834.834 0 0 0 0 1.667h1.667a.834.834 0 0 0 0-1.667zm-10 4.167a.84.84 0 0 0-.599.234l-1.146 1.146a.826.826 0 0 0 0 1.171.857.857 0 0 0 1.199 0l1.146-1.119a.86.86 0 0 0 0-1.198.85.85 0 0 0-.6-.234m8.334 0a.84.84 0 0 0-.6.234.857.857 0 0 0 0 1.198l1.173 1.146a.825.825 0 0 0 1.172 0 .857.857 0 0 0 0-1.198l-1.146-1.146a.85.85 0 0 0-.6-.234m-4.167 1.666a.834.834 0 0 0-.833.834v1.666a.834.834 0 0 0 1.666 0v-1.666a.834.834 0 0 0-.833-.834" />
  </svg>
);

export const MoonIcon: React.FC = () => (
  <svg className="w-5 h-5 fill-white" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.524 2.075c-.728-.229-1.35.566-.964 1.225.61 1.038.938 2.21.938 3.385A6.667 6.667 0 0 1 5.83 13.35 6.9 6.9 0 0 1 3.8 13.04c-.727-.23-1.375.566-.99 1.224C4.292 16.79 7 18.35 9.998 18.35a8.333 8.333 0 0 0 8.333-8.333 8.31 8.31 0 0 0-5.807-7.943" />
  </svg>
);

export const BackArrowIcon: React.FC = () => (
  <svg className="fill-[#F1F3F4] bvi-svg" fill="none" height="24" width="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path clipRule="evenodd" d="M16.058 3.21a.99.99 0 0 1 .439.657.92.92 0 0 1-.214.741L9.985 12l6.298 7.392a.92.92 0 0 1 .213.74.99.99 0 0 1-.438.659 1.2 1.2 0 0 1-.4.175 1.26 1.26 0 0 1-.867-.108 1.1 1.1 0 0 1-.33-.267l-6.658-7.812A1.2 1.2 0 0 1 7.508 12c0-.281.104-.555.295-.78l6.658-7.81q.134-.165.33-.268a1.262 1.262 0 0 1 .867-.108c.145.034.281.094.4.176" />
  </svg>
);

export const SearchIcon: React.FC = () => (
  <svg fill="none" height="24" width="24" viewBox="0 0 24 24" className="fill-[#7E8B99]" xmlns="http://www.w3.org/2000/svg">
    <path clipRule="evenodd" d="M13.793 13.793a1 1 0 0 1 1.414 0l5.5 5.5a1 1 0 0 1-1.414 1.414l-5.5-5.5a1 1 0 0 1 0-1.414" />
    <path clipRule="evenodd" d="M10 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10m-7 5a7 7 0 1 1 14 0 7 7 0 0 1-14 0" />
  </svg>
);

export const SecurityCategoryIcon: React.FC = () => (
  <svg fill="none" height="40" viewBox="0 0 24 24" width="40" xmlns="http://www.w3.org/2000/svg">
    <path d="M5.80688 18.5304C5.82459 18.5005 5.84273 18.4709 5.8613 18.4413C7.2158 16.2881 7.99991 13.7418 7.99991 11C7.99991 8.79086 9.79077 7 11.9999 7C14.209 7 15.9999 8.79086 15.9999 11C15.9999 12.017 15.9307 13.0186 15.7966 14M13.6792 20.8436C14.2909 19.6226 14.7924 18.3369 15.1707 17M19.0097 18.132C19.6547 15.8657 20 13.4732 20 11C20 6.58172 16.4183 3 12 3C10.5429 3 9.17669 3.38958 8 4.07026M3 15.3641C3.64066 14.0454 4 12.5646 4 11C4 9.54285 4.38958 8.17669 5.07026 7M11.9999 11C11.9999 14.5172 10.9911 17.7988 9.24707 20.5712" stroke="#7E8B99" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

export const StarIcon: React.FC<{ isActive?: boolean }> = ({ isActive }) => (
  <svg className={`w-6 h-6 min-w-6 ${isActive ? 'fill-[#00BC58]' : 'fill-[#78878F]'}`} fill="none" height="24" viewBox="0 0 23 22" width="24" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.109 1.935c.505-1.252 2.277-1.252 2.782 0l1.937 4.802a.5.5 0 0 0 .423.311l4.866.397c1.32.108 1.863 1.747.869 2.622l-3.693 3.247a.5.5 0 0 0-.158.483l1.181 5.367c.295 1.341-1.217 2.34-2.335 1.545l-4.191-2.985a.5.5 0 0 0-.58 0L7.018 20.71c-1.118.796-2.63-.204-2.335-1.545l1.181-5.367a.5.5 0 0 0-.158-.483l-3.693-3.247c-.994-.875-.45-2.514.87-2.622l4.865-.397a.5.5 0 0 0 .423-.311z" />
  </svg>
);

export const SheetIcon: React.FC<{ isActive?: boolean }> = ({ isActive }) => (
  <svg className={`w-6 h-6 min-w-6 ${isActive ? 'fill-[#00BC58]' : 'fill-[#78878F]'}`} fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
    <path clipRule="evenodd" d="M14.691 2.11C14.228 2 13.75 2 13.114 2H9.759c-.805 0-1.47 0-2.01.044-.563.046-1.08.145-1.565.392a4 4 0 0 0-1.748 1.748c-.247.485-.346 1.002-.392 1.564C4 6.29 4 6.954 4 7.758v8.483c0 .805 0 1.47.044 2.01.046.563.145 1.08.392 1.565a4 4 0 0 0 1.748 1.748c.485.247 1.002.346 1.564.392C8.29 22 8.954 22 9.758 22h4.483c.805 0 1.47 0 2.01-.044.563-.046 1.08-.145 1.565-.392a4 4 0 0 0 1.748-1.748c.247-.485.346-1.002.392-1.564.044-.541.044-1.206.044-2.01V8.885c0-.635 0-1.114-.11-1.577a4 4 0 0 0-.48-1.156c-.248-.406-.587-.745-1.037-1.194l-1.332-1.332c-.449-.45-.788-.789-1.194-1.037a4 4 0 0 0-1.156-.48M13 4H9.8c-.857 0-1.439 0-1.889.038-.438.035-.663.1-.819.18a2 2 0 0 0-.874.874c-.08.156-.145.38-.18.82C6 6.361 6 6.942 6 7.8v8.4c0 .857 0 1.439.038 1.889.035.438.1.663.18.819a2 2 0 0 0 .874.874c.156.08.38.145.819.18C8.361 20 8.943 20 9.8 20h4.4c.857 0 1.439 0 1.889-.038.438-.035.663-.1.819-.18a2 2 0 0 0 .874-.874c.08-.156.145-.38.18-.819.037-.45.038-1.032.038-1.889V9h-2a3 3 0 0 1-3-3zm4.56 3c-.12-.142-.312-.338-.673-.699l-1.188-1.188A14 14 0 0 0 15 4.44V6a1 1 0 0 0 1 1z" />
  </svg>
);

export const ChevronRightIcon: React.FC<{ isActive?: boolean }> = ({ isActive }) => (
  <svg className={`w-4 h-4 min-w-4 ml-2 fill-current ${isActive ? 'text-[#00BC58]' : 'text-[#78878F]'}`} fill="none" height="16" width="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <path clipRule="evenodd" d="M5.304 13.86a.66.66 0 0 1-.293-.438.61.61 0 0 1 .143-.494L9.353 8l-4.2-4.928a.61.61 0 0 1-.142-.494.66.66 0 0 1 .293-.438.8.8 0 0 1 .267-.118.84.84 0 0 1 .578.073q.13.069.22.178l4.438 5.208c.128.149.197.331.197.519s-.07.37-.197.52l-4.439 5.207a.7.7 0 0 1-.22.178.81.81 0 0 1-.577.073.8.8 0 0 1-.267-.118" />
  </svg>
);

export const AccordionPlusIcon: React.FC<{ isOpen?: boolean }> = ({ isOpen }) => (
  <svg className={`w-6 h-6 stroke-current transition-transform duration-200 ${isOpen ? 'rotate-45 text-[#00BC58]' : 'text-[#7E8B99]'}`} fill="none" height="24" width="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 19.106V4.895M4.894 12h14.211" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const ThumbsUpIcon: React.FC = () => (
  <svg className="fill-current w-4 h-4" fill="none" height="16" width="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <path clipRule="evenodd" d="M7.152 2.273a.5.5 0 0 1 .217-.256c.067-.042.138-.05.415-.05.2 0 .42.017.544.043.911.187 1.572.924 1.652 1.842.02.232-.043.747-.136 1.115-.055.215-.099.336-.251.69-.012.027.328.034 1.648.034 1.087 0 1.73.01 1.858.03.783.121 1.359.64 1.524 1.375.025.108.044.275.044.37 0 .274-.777 5.177-.854 5.389a1.6 1.6 0 0 1-.44.664 1.9 1.9 0 0 1-.73.44 1.3 1.3 0 0 1-.392.064l-2.517.007c-2.529.007-2.867.015-3.154-.103-.06-.025-.119-.056-.195-.093a4 4 0 0 1-.505-.313l-.265-.196V6.357l.165-.106c.505-.325.951-.908 1.166-1.522.143-.41.164-.612.164-1.53 0-.682.008-.844.042-.926M2.334 6.309a1 1 0 0 0-1 1v5.34a1 1 0 0 0 1 1h1.099a1 1 0 0 0 1-1v-5.34a1 1 0 0 0-1-1z" />
  </svg>
);

export const ThumbsDownIcon: React.FC = () => (
  <svg className="fill-current w-4 h-4" fill="none" height="16" width="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <path clipRule="evenodd" d="M8.848 13.727a.5.5 0 0 1-.217.256c-.067.042-.138.05-.415.05-.2 0-.42-.017-.544-.043a2.05 2.05 0 0 1-1.652-1.842c-.02-.232.043-.747.136-1.115-.055-.215.099-.336.251-.69.012-.027-.328-.034-1.648-.034-1.087 0-1.73-.01-1.858-.03-.783-.121-1.359-.64-1.524-1.375a2 2 0 0 1-.044-.371c0-.273.777-5.176.854-5.388a1.6 1.6 0 0 1 .44-.664c.217-.207.448-.345.73-.44q.192-.064.392-.064l2.517-.007c2.529-.007 2.867-.015 3.155.103.06.025.118.056.194.093.132.064.359.205.505.313l.265.196v6.968l-.165.106c-.505.325-.95.908-1.165 1.522-.144.41-.165.612-.165 1.53 0 .682-.008.844-.042.926m4.818-4.036a1 1 0 0 0 1-1v-5.34a1 1 0 0 0-1-1h-1.099a1 1 0 0 0-1 1v5.34a1 1 0 0 0 1 1z" />
  </svg>
);

// ==========================================
// STATIC DATA: TABS & ACCORDION DATA
// ==========================================
const SIDEBAR_TABS: SidebarTab[] = [
  { id: 'popular', title: 'Популярные вопросы', iconType: 'star' },
  { id: 'calls', title: 'Звонки и сообщения', iconType: 'sheet' },
  { id: 'victim', title: 'Если стали жертвой мошенников', iconType: 'sheet' },
  { id: 'invest', title: 'Инвестиции и покупки в интернете', iconType: 'sheet' },
  { id: 'app_issues', title: 'Проблемы с приложением и доступом', iconType: 'sheet' },
  { id: 'fake_credit', title: 'Мошеннический кредит', iconType: 'sheet' },
];

const ACCORDIONS_DATA: AccordionItemData[] = [
  {
    id: 1,
    categoryIds: ['popular', 'app_issues'],
    title: 'Я хотел зарегистрироваться в Freedom SuperApp, но приложение выдало ошибку 2011. Что это такое и что делать?',
    updateDate: '06.11.2026',
    voteStats: null,
    content: (
      <div className="space-y-4 text-base leading-[22px] text-[#F1F3F4]">
        <p>
          Ошибка 2011 означает, что Google Play не смог подтвердить подлинность приложения или источника установки (например, при изменении структуры приложения, использовании несертифицированного устройства или установке из неофициальных каналов).
        </p>
        <p className="font-semibold text-white">
          Если вы столкнулись с ошибкой 2011, сначала перезапустите сетевое соединение:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Включите и отключите авиарежим.</li>
          <li>Переключитесь с мобильной сети на Wi-Fi или наоборот.</li>
        </ul>
        <p className="font-semibold text-white">
          Чаще всего такая ошибка возникает в двух случаях:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Запрос приходит с иностранного IP-адреса (например, через VPN или из другой страны).</li>
          <li>Номер, с которого пришел запрос, принадлежит оператору связи, ранее замеченному в массовых СМС-атаках.</li>
        </ul>
        <div className="rounded-2xl p-4 my-4 bg-[rgba(112,123,136,0.08)] border-l-2 border-[#00BC58]">
          <p className="leading-5">
            <strong className="font-semibold text-white">Важно! </strong>
            Это не сбой, а работа механизма защиты от мошеннических и хакерских действий.
          </p>
        </div>
        <p>
          <a
            href="https://support.bankffin.kz/ru/fiz-litsam/problemy-s-prilozeniem-i-dostupom?questionId=3507"
            target="_blank"
            rel="noreferrer"
            className="text-[#00BC58] hover:underline font-normal inline-block"
          >
            Что делать, если перезапуск сети при 2011 ошибке не помог (инструкция для Android)?
          </a>
        </p>
      </div>
    ),
  },
  {
    id: 2,
    categoryIds: ['popular', 'app_issues'],
    title: 'Что делать, если перезапуск сети при 2011 ошибке не помог (инструкция для Android)?',
    updateDate: '06.11.2026',
    voteStats: null,
    content: (
      <div className="space-y-3 text-base leading-[22px] text-[#F1F3F4]">
        <p>Если сброс соединения не решил проблему, проверьте Play Защиту:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Откройте приложение Google Play (Play Market).</li>
          <li>Перейдите в свой Google-профиль.</li>
          <li>Перейдите в раздел «Play Защита».</li>
          <li>Откройте настройки и убедитесь, что тумблеры сканирования включены (если они отключены, это может быть причиной ошибки).</li>
          <li>После завершения сканирования перезагрузите устройство и повторно авторизуйтесь в Freedom SuperApp.</li>
        </ol>
      </div>
    ),
  },
  {
    id: 3,
    categoryIds: ['popular', 'victim', 'app_issues'],
    title: 'Приложение заблокировалось. Что делать?',
    updateDate: '12.10.2026',
    voteStats: '77% считают что «Да»',
    content: (
      <div className="text-base leading-[22px] text-[#F1F3F4]">
        <p>
          Свяжитесь со службой поддержки по номеру <strong className="text-[#00BC58] font-semibold">595</strong> либо напишите в чат — на сайте в правом нижнем углу есть специальный виджет.
        </p>
      </div>
    ),
  },
  {
    id: 4,
    categoryIds: ['popular', 'invest', 'calls'],
    title: 'Позвонил финансовый консультант и предлагает быструю прибыль. Можно доверять?',
    updateDate: '13.10.2026',
    voteStats: '100% считают что «Да»',
    content: (
      <div className="text-base leading-[22px] text-[#F1F3F4]">
        <p>
          Нет. Это мошенничество. Банки и официальные инвестиционные компании не звонят клиентам с предложениями «быстрого заработка». Мошенники могут показать ложную прибыль, чтобы убедить вас перевести деньги. Не сообщайте личные данные и не переводите средства.
        </p>
      </div>
    ),
  },
  {
    id: 5,
    categoryIds: ['popular', 'invest'],
    title: 'Не потеряю ли я деньги на депозите?',
    updateDate: '12.10.2026',
    voteStats: '100% считают что «Да»',
    content: (
      <div className="space-y-3 text-base leading-[22px] text-[#F1F3F4]">
        <p>
          Все депозиты застрахованы Казахстанским фондом гарантирования депозитов. Фонд покрывает до 20 000 000 ₸. Подробнее с работой фонда можно ознакомиться{' '}
          <a href="https://www.kdif.kz/" target="_blank" rel="noreferrer" className="text-[#00BC58] hover:underline font-medium">
            здесь
          </a>
          .
        </p>
        <p>Мы всегда работаем над повышением безопасности банка.</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>В 2021 году наш банк вошел в пятерку самых защищенных банков Казахстана по данным Центра анализа и расследования кибератак.</li>
          <li>В 2025 году получил награду Антифрод-центра Национального банка РК за эффективную защиту клиентов от мошенничества.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 6,
    categoryIds: ['popular', 'calls', 'victim', 'fake_credit'],
    title: 'Мне звонят / пишут и спрашивают данные карты. Это мошенники?',
    updateDate: '13.10.2026',
    voteStats: '100% считают что «Да»',
    content: (
      <div className="space-y-4 text-base leading-[22px] text-[#F1F3F4]">
        <p>
          Если вам позвонили, представились сотрудниками банка и спрашивают данные карты или любые другие личные данные, ни в коем случае не сообщайте их и не продолжайте разговор. Вероятнее всего, это мошенники. Если вам нужна помощь, свяжитесь с нами по номеру{' '}
          <strong className="text-[#00BC58]">595</strong> или через специальную почту для экстренных сообщений{' '}
          <a href="mailto:911@bankffin.kz" className="text-[#00BC58] hover:underline font-medium">
            911@bankffin.kz
          </a>{' '}
          — мы поможем.
        </p>
        <p className="font-semibold text-white">
          Помните, что ни в коем случае нельзя сообщать следующие данные:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>SMS-коды, которые приходят при платежах и переводах;</li>
          <li>срок действия карты;</li>
          <li>имя и фамилию владельца;</li>
          <li>CVV/СVC — трехзначный номер на обратной стороне карты;</li>
          <li>ПИН-код.</li>
        </ul>
        <a
          href="mailto:911@bankffin.kz"
          className="w-[400px] max-w-full h-10 rounded-[20px] bg-[#00BF52] hover:bg-[#00BC58] active:bg-[#009b48] text-white font-medium text-base flex items-center justify-center my-4 transition-all shadow-sm"
        >
          Написать на почту
        </a>
      </div>
    ),
  },
];

// ==========================================
// MAIN COMPONENT
// ==========================================
export const SecurityHelpPage: React.FC = () => {
  const [activeTabId, setActiveTabId] = useState<string>('popular');
  const [openAccordionId, setOpenAccordionId] = useState<number | null>(1); // 1st accordion open by default
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [userVotes, setUserVotes] = useState<Record<number, 'yes' | 'no'>>({});
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Active Tab Title
  const activeTabTitle = useMemo(() => {
    return SIDEBAR_TABS.find((t) => t.id === activeTabId)?.title || 'Популярные вопросы';
  }, [activeTabId]);

  // Filtered Accordions
  const filteredAccordions = useMemo(() => {
    return ACCORDIONS_DATA.filter((item) => {
      const matchesTab = activeTabId === 'popular' || item.categoryIds.includes(activeTabId);
      const matchesSearch = !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [activeTabId, searchQuery]);

  const toggleAccordion = (id: number) => {
    setOpenAccordionId((prev) => (prev === id ? null : id));
  };

  const handleVote = (id: number, vote: 'yes' | 'no') => {
    setUserVotes((prev) => ({
      ...prev,
      [id]: prev[id] === vote ? (undefined as unknown as 'yes') : vote,
    }));
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-[#121415]' : 'bg-[#F4F6F8]'} text-[#F1F3F4] font-sans transition-colors duration-200 py-6 px-4`}>
      <div className="w-full max-w-[1032px] mx-auto flex flex-col">

        {/* 1. HEADER (max-w-[1032px], bg-[#1D2022], rounded-b-[24px]) */}
        <header className="w-full h-20 bg-[#1D2022] rounded-b-[24px] shadow-[0_5px_5px_rgba(120,135,143,0.04)] px-8 flex items-center justify-between z-20">
          <BankLogo />

          <div className="flex items-center gap-3">
            {/* Phone button: 595 */}
            <a
              href="tel:595"
              className="h-8 px-3 rounded-2xl bg-[#1D2022] border border-[rgba(120,135,143,0.12)] hover:border-[#00BC58]/50 hover:bg-[rgba(126,139,153,0.08)] active:bg-[rgba(126,139,153,0.16)] flex items-center gap-1.5 transition-all"
            >
              <PhoneIcon />
              <span className="text-sm font-medium text-[#00BC58]">595</span>
            </a>

            {/* Accessibility / Eye button */}
            <button
              type="button"
              aria-label="Версия для слабовидящих"
              className="w-8 h-8 rounded-2xl bg-[rgba(126,139,153,0.16)] hover:bg-[rgba(126,139,153,0.26)] active:scale-95 flex items-center justify-center transition-all cursor-pointer"
            >
              <EyeIcon />
            </button>

            {/* Language dropdown */}
            <button
              type="button"
              className="w-[69px] h-8 px-3 rounded-2xl bg-[rgba(126,139,153,0.16)] hover:bg-[rgba(126,139,153,0.26)] active:scale-95 flex items-center justify-between text-sm font-medium text-[#7E8B99] hover:text-[#F1F3F4] transition-all cursor-pointer"
            >
              <span>Рус</span>
              <ChevronDownIcon />
            </button>

            {/* Theme switch toggle */}
            <button
              type="button"
              aria-label="Переключить тему"
              onClick={() => setIsDarkMode((prev) => !prev)}
              className="relative w-16 h-8 rounded-full bg-[rgba(126,139,153,0.16)] p-0.5 flex items-center cursor-pointer select-none transition-colors"
            >
              <span
                className={`absolute flex h-[28px] w-[28px] rounded-full bg-[#00BC58] transition-all duration-200 ease-linear ${
                  isDarkMode ? 'left-[34px]' : 'left-[2px]'
                }`}
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-1.5">
                <SunIcon />
                <MoonIcon />
              </div>
            </button>
          </div>
        </header>

        {/* 2. TOP ACTION ROW (Back Button + Search Bar) */}
        <div className="flex items-center justify-between gap-6 pt-12 pb-6">
          {/* Back button */}
          <div className="w-[328px] shrink-0">
            <button
              type="button"
              className="h-14 px-5 rounded-[20px] border-[1.5px] border-[rgba(120,135,143,0.16)] hover:border-[rgba(120,135,143,0.32)] hover:bg-[rgba(126,139,153,0.08)] active:bg-[rgba(126,139,153,0.16)] active:scale-[0.98] flex items-center gap-2.5 text-[#F1F3F4] font-medium text-base transition-all cursor-pointer"
            >
              <BackArrowIcon />
              <span>Назад</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="w-[680px] shrink-0 relative">
            <div className="relative w-full">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <SearchIcon />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Как мы можем помочь?"
                className="w-full h-14 pl-12 pr-10 rounded-[20px] bg-[rgba(126,139,153,0.16)] text-[#F1F3F4] placeholder-[#7E8B99] text-base border border-transparent focus:border-[rgba(120,135,143,0.32)] focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* 3. CATEGORY HEADER */}
        <div className="flex items-center gap-3 pb-6">
          <div className="w-10 h-10 flex items-center justify-center">
            <SecurityCategoryIcon />
          </div>
          <h1 className="text-[28px] font-bold text-[#F1F3F4] leading-10">Безопасность</h1>
        </div>

        {/* 4. TWO-COLUMN LAYOUT (Sidebar: 328px + Content: 680px, gap-6) */}
        <div className="flex items-start gap-6">

          {/* Left Sidebar (w-[328px]) */}
          <aside className="w-[328px] shrink-0 flex flex-col gap-3">

            {/* Subsections Navigation */}
            <nav className="bg-[#1D2022] rounded-[20px] overflow-hidden">
              <ul className="flex flex-col">
                {SIDEBAR_TABS.map((tab, idx) => {
                  const isActive = tab.id === activeTabId;
                  const isFirst = idx === 0;
                  const isLast = idx === SIDEBAR_TABS.length - 1;

                  return (
                    <li key={tab.id}>
                      <button
                        type="button"
                        onClick={() => setActiveTabId(tab.id)}
                        className={`w-full min-h-[56px] flex items-center justify-between px-4 py-3.5 text-left transition-colors cursor-pointer select-none ${
                          isFirst ? 'rounded-t-[20px]' : ''
                        } ${isLast ? 'rounded-b-[20px]' : ''} ${
                          isActive
                            ? 'bg-[rgba(126,139,153,0.12)] text-[#00BC58]'
                            : 'text-[#78878F] hover:text-[#F1F3F4] hover:bg-[rgba(126,139,153,0.06)] active:bg-[rgba(126,139,153,0.12)]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {tab.iconType === 'star' ? <StarIcon isActive={isActive} /> : <SheetIcon isActive={isActive} />}
                          <span className={`text-base font-medium leading-5 ${isActive ? 'text-[#00BC58]' : ''}`}>
                            {tab.title}
                          </span>
                        </div>
                        <ChevronRightIcon isActive={isActive} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Articles Block */}
            <section className="bg-[#1D2022] rounded-[20px] p-5 flex flex-col">
              <h2 className="text-lg font-semibold text-[#F1F3F4] mb-3">Статьи</h2>
              <div className="flex items-start gap-3">
                <img
                  src="https://api-support.bankffin.kz/attachments/115"
                  alt="Чек-лист безопасности"
                  className="w-16 h-16 rounded-2xl object-cover shrink-0 bg-[rgba(126,139,153,0.16)]"
                  onError={(e) => {
                    // Fallback to stylized SVG placeholder if external CDN is blocked
                    e.currentTarget.src =
                      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><rect width='64' height='64' rx='16' fill='%23282C30'/><path d='M32 20v24M20 32h24' stroke='%2300BC58' stroke-width='3' stroke-linecap='round'/></svg>";
                  }}
                />
                <div className="flex flex-col">
                  <h3 className="text-base font-medium leading-[22px] text-[#F1F3F4] line-clamp-3">
                    Как не стать жертвой мошенников: чек-лист безопасности
                  </h3>
                  <span className="text-xs text-[#78878F] mt-1">Безопасность</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3 mt-1">
                <button
                  type="button"
                  className="flex-1 h-10 rounded-[20px] bg-[#00BC58] hover:bg-[#00BF52] active:bg-[#009b48] text-white font-medium text-base flex items-center justify-center transition-all cursor-pointer shadow-sm"
                >
                  Читать
                </button>
                <a
                  href="/ru/fiz-litsam/all/articles"
                  className="flex-1 h-10 rounded-[20px] bg-[rgba(126,139,153,0.16)] hover:bg-[rgba(126,139,153,0.24)] active:bg-[rgba(126,139,153,0.32)] text-[#F1F3F4] font-medium text-base flex items-center justify-center transition-all"
                >
                  Еще статьи
                </a>
              </div>
            </section>

          </aside>

          {/* Right Content Area (w-[680px]) */}
          <main className="w-[680px] shrink-0 bg-[#1D2022] rounded-[20px] p-5 flex flex-col">
            {/* Dynamic Content Heading */}
            <h2 className="text-[28px] font-bold text-[#F1F3F4] leading-10 mb-5">
              {activeTabTitle}
            </h2>

            {/* Accordions Container */}
            <div className="flex flex-col gap-[1px]">
              {filteredAccordions.length === 0 ? (
                <div className="py-12 text-center text-[#7E8B99]">
                  По вашему запросу ничего не найдено
                </div>
              ) : (
                filteredAccordions.map((item, index) => {
                  const isOpen = openAccordionId === item.id;
                  const isFirst = index === 0;
                  const isLast = index === filteredAccordions.length - 1;

                  const roundedClasses = `
                    ${isFirst ? 'rounded-t-[20px] rounded-b-lg' : ''}
                    ${isLast ? 'rounded-b-[20px] rounded-t-lg' : ''}
                    ${!isFirst && !isLast ? 'rounded-lg' : ''}
                    ${filteredAccordions.length === 1 ? '!rounded-[20px]' : ''}
                  `;

                  const vote = userVotes[item.id];

                  return (
                    <div
                      key={item.id}
                      className={`bg-[rgba(126,139,153,0.08)] border transition-all ${roundedClasses} ${
                        isOpen
                          ? 'border-[rgba(120,135,143,0.16)]'
                          : 'border-transparent hover:bg-[rgba(126,139,153,0.12)]'
                      }`}
                    >
                      {/* Accordion Header */}
                      <button
                        type="button"
                        onClick={() => toggleAccordion(item.id)}
                        className="w-full px-5 py-4 flex items-center justify-between text-left gap-4 cursor-pointer select-none"
                      >
                        <span className="text-base font-medium leading-5 text-[#F1F3F4]">
                          {item.title}
                        </span>
                        <div className="shrink-0 flex items-center justify-center">
                          <AccordionPlusIcon isOpen={isOpen} />
                        </div>
                      </button>

                      {/* Accordion Content */}
                      {isOpen && (
                        <div className="px-5 pb-5 pt-1 text-base text-[#F1F3F4] border-t border-[rgba(120,135,143,0.08)]">
                          <div className="ck-content leading-[22px] mb-4">
                            {item.content}
                          </div>

                          {/* Update Date */}
                          <p className="text-xs text-[#7E8B99] mb-4">
                            Обновлен: {item.updateDate}
                          </p>

                          {/* Voting Box */}
                          <div className="rounded-2xl p-4 bg-[rgba(126,139,153,0.08)] border border-[rgba(120,135,143,0.12)] flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-[#7E8B99]">
                                Был ли ответ полезен?
                              </p>
                              {item.voteStats && (
                                <p className="text-sm text-[#7E8B99] mt-0.5">
                                  {item.voteStats}
                                </p>
                              )}
                            </div>

                            {/* "Да" / "Нет" Feedback Buttons */}
                            <div className="flex items-center gap-2">
                              {/* "Да" button */}
                              <button
                                type="button"
                                onClick={() => handleVote(item.id, 'yes')}
                                className={`h-[42px] px-4 rounded-2xl border text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                                  vote === 'yes'
                                    ? 'bg-[#00BC58]/20 border-[#00BC58] text-[#00BC58]'
                                    : 'border-[rgba(120,135,143,0.16)] bg-transparent hover:bg-[#00BC58]/15 hover:border-[#00BC58] text-[#F1F3F4] active:scale-95'
                                }`}
                              >
                                <ThumbsUpIcon />
                                <span>Да</span>
                              </button>

                              {/* "Нет" button */}
                              <button
                                type="button"
                                onClick={() => handleVote(item.id, 'no')}
                                className={`h-[42px] px-4 rounded-2xl border text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                                  vote === 'no'
                                    ? 'bg-red-500/20 border-red-500 text-red-400'
                                    : 'border-[rgba(120,135,143,0.16)] bg-transparent hover:bg-red-500/15 hover:border-red-500 text-[#F1F3F4] active:scale-95'
                                }`}
                              >
                                <ThumbsDownIcon />
                                <span>Нет</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </main>

        </div>
      </div>
    </div>
  );
};

export default SecurityHelpPage;
