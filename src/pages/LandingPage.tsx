import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory,
  Users,
  LayoutGrid,
  ArrowRight,
  Lock,
} from 'lucide-react';

import logo from '@/assets/logo.png';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  const systems = [
    {
      title: 'Traceability',
      description:
        'Manage manufacturing, stock, batches, receiving, quality control and dispatch.',
      icon: Factory,
      color: 'red',
      available: true,
      action: () => navigate('/dashboard'),
    },
    {
      title: 'HR Department',
      description:
        'Manage employees, attendance, leave, documents and other HR activities.',
      icon: Users,
      color: 'green',
      available: true,
      action: () => navigate('/hr-login'),
    },
    {
      title: 'More Systems',
      description:
        'Additional business systems and departments will be added here in the future.',
      icon: LayoutGrid,
      color: 'orange',
      available: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7f7f6] text-[#18202b]">

      {/* Header */}
      <header className="border-b border-gray-200 bg-[#202733]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">

          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Maharaja's Spices"
              className="h-12 w-auto object-contain"
            />

            <div className="border-l border-white/20 pl-3">
              <p className="text-lg font-semibold text-white">
                Maharaja's Spices
              </p>
              <p className="text-xs text-gray-400">
                Business Systems
              </p>
            </div>
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-white">
              Internal Portal
            </p>
            <p className="text-xs text-gray-400">
              Business Management Systems
            </p>
          </div>

        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-16">

        {/* Welcome */}
        <section className="mb-12 text-center">

          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 shadow-sm">
              <img
                src={logo}
                alt="Maharaja's Spices"
                className="h-14 w-auto object-contain"
              />
            </div>
          </div>

          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#ef302b]">
            Maharaja's Spices
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#18202b] sm:text-4xl lg:text-5xl">
            Business Systems Portal
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-500 sm:text-lg">
            Welcome to the Maharaja's Spices business portal.
            Select a system below to continue.
          </p>

        </section>

        {/* System Cards */}
        <section className="grid gap-6 md:grid-cols-3">

          {systems.map((system) => {
            const Icon = system.icon;
            const isAvailable = system.available;

            return (
              <div
                key={system.title}
                className={`group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 ${
                  isAvailable
                    ? 'border-gray-200 hover:-translate-y-1 hover:shadow-xl'
                    : 'border-gray-200'
                }`}
              >

                {/* Top accent */}
                <div
                  className={`h-1 ${
                    system.color === 'red'
                      ? 'bg-[#ef302b]'
                      : system.color === 'green'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                />

                <div className="p-7">

                  {/* Icon */}
                  <div
                    className={`mb-6 flex h-14 w-14 items-center justify-center rounded-xl ${
                      system.color === 'red'
                        ? 'bg-red-50 text-[#ef302b]'
                        : system.color === 'green'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>

                  {/* Content */}
                  <h2 className="text-xl font-bold text-[#18202b]">
                    {system.title}
                  </h2>

                  <p className="mt-3 min-h-[72px] text-sm leading-6 text-gray-500">
                    {system.description}
                  </p>

                  {/* Button */}
                  {isAvailable ? (
                    <button
                      onClick={system.action}
                      className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-[#ef302b] px-5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#d92824] hover:shadow-lg"
                    >
                      Enter System
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  ) 
                  :
                  
                  (
                    <button
                      disabled
                      className="mt-7 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-gray-100 px-5 py-3.5 text-sm font-semibold text-gray-400"
                    >
                      <Lock className="h-4 w-4" />
                      Coming Soon
                    </button>
                  )}

                </div>
              </div>
            );
          })}

        </section>

        {/* Future systems section */}
        <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-sm font-semibold text-[#18202b]">
                More systems coming soon
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Additional departments and business tools can be added to
                this portal as the company grows.
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
              <LayoutGrid className="h-4 w-4" />
              Future Modules
            </div>

          </div>

        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-gray-400 sm:flex-row lg:px-10">

          <p>
            © {new Date().getFullYear()} Maharaja's Spices
          </p>

          <p>
            Internal Business Systems
          </p>

        </div>
      </footer>

    </div>
  );
};

export default Landing;