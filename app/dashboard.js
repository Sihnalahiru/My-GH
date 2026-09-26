/* BUILD-09 — Dashboard / Navigation Engine
 *
 * UI orchestration layer only.
 * It does not create or modify source facts.
 */
(function () {
  "use strict";

  const ROUTES = Object.freeze({
    HOME: "home",
    STUDY: "study",
    MCQ: "mcq",
    OFFICIAL_SAMPLES: "official-samples",
    VISUAL_LIBRARY: "visual-library",
    GLOSSARY: "glossary",
    SEARCH: "search",
    PROGRESS: "progress",
    REAL_EXAM: "real-exam",
    SETTINGS: "settings"
  });

  const NAV_ITEMS = Object.freeze([
    {
      id: "home",
      route: ROUTES.HOME,
      title: "Ground Handling Exam",
      icon: "home",
      priority: "primary"
    },
    {
      id: "study",
      route: ROUTES.STUDY,
      title: "Study",
      icon: "book",
      priority: "primary"
    },
    {
      id: "mcq",
      route: ROUTES.MCQ,
      title: "MCQ Practice",
      icon: "quiz",
      priority: "primary"
    },
    {
      id: "official-samples",
      route: ROUTES.OFFICIAL_SAMPLES,
      title: "Official Samples",
      icon: "official",
      priority: "primary"
    },
    {
      id: "visual-library",
      route: ROUTES.VISUAL_LIBRARY,
      title: "Visual Library",
      icon: "image",
      priority: "secondary"
    },
    {
      id: "glossary",
      route: ROUTES.GLOSSARY,
      title: "Technical Terms",
      icon: "language",
      priority: "secondary"
    },
    {
      id: "search",
      route: ROUTES.SEARCH,
      title: "Search",
      icon: "search",
      priority: "secondary"
    },
    {
      id: "progress",
      route: ROUTES.PROGRESS,
      title: "Progress",
      icon: "chart",
      priority: "secondary"
    },
    {
      id: "real-exam",
      route: ROUTES.REAL_EXAM,
      title: "Real Exam Mode",
      icon: "timer",
      priority: "secondary"
    }
  ]);

  const QUICK_ACTIONS = Object.freeze([
    {
      id: "continue-study",
      route: ROUTES.STUDY,
      title: "Continue Study",
      icon: "play"
    },
    {
      id: "start-mcq",
      route: ROUTES.MCQ,
      title: "Start MCQ",
      icon: "quiz"
    },
    {
      id: "official-samples",
      route: ROUTES.OFFICIAL_SAMPLES,
      title: "Official Samples",
      icon: "official"
    },
    {
      id: "visual-library",
      route: ROUTES.VISUAL_LIBRARY,
      title: "Visual Library",
      icon: "image"
    }
  ]);

  const DASHBOARD_SECTIONS = Object.freeze([
    "hero",
    "progress",
    "quick_actions",
    "study_tracks",
    "recent_activity",
    "recommended_next",
    "navigation"
  ]);

  class NavigationController {
    constructor(options = {}) {
      this.routes = options.routes || ROUTES;
      this.currentRoute = ROUTES.HOME;
      this.history = [];
      this.listeners = new Set();
      this.started = false;
    }

    onChange(callback) {
      this.listeners.add(callback);
      return () => this.listeners.delete(callback);
    }

    emit(route, meta = {}) {
      for (const callback of this.listeners) {
        try {
          callback(route, meta);
        } catch (_) {}
      }
    }

    start(initialRoute = ROUTES.HOME) {
      this.started = true;
      this.go(initialRoute, {
        replace: true,
        initial: true
      });
      return this.currentRoute;
    }

    normalize(route) {
      const known = Object.values(this.routes);
      return known.includes(route) ? route : ROUTES.HOME;
    }

    go(route, meta = {}) {
      const next = this.normalize(route);

      if (!meta.replace && this.currentRoute !== next) {
        this.history.push(this.currentRoute);
      }

      this.currentRoute = next;

      if (typeof window !== "undefined" && window.location) {
        const hash = `#/${next}`;
        if (window.location.hash !== hash) {
          if (meta.replace && window.history?.replaceState) {
            window.history.replaceState(null, "", hash);
          } else if (window.history?.pushState) {
            window.history.pushState(null, "", hash);
          } else {
            window.location.hash = hash;
          }
        }
      }

      this.emit(next, meta);
      return next;
    }

    back() {
      const previous = this.history.pop();

      if (!previous) {
        return this.go(ROUTES.HOME, { replace: true });
      }

      return this.go(previous, {
        replace: true,
        fromHistory: true
      });
    }

    routeFromHash(hash = "") {
      const clean = String(hash).replace(/^#\/?/, "");
      return this.normalize(clean || ROUTES.HOME);
    }

    handleHashChange() {
      if (typeof window === "undefined") return;

      const route = this.routeFromHash(window.location.hash);
      if (route !== this.currentRoute) {
        this.currentRoute = route;
        this.emit(route, { external: true });
      }
    }
  }

  function createProgressModel(progress = {}) {
    const total = Number.isFinite(progress.total)
      ? Math.max(progress.total, 0)
      : 0;

    const completed = Number.isFinite(progress.completed)
      ? Math.min(Math.max(progress.completed, 0), total)
      : 0;

    const percentage = total
      ? Math.round((completed / total) * 100)
      : 0;

    return {
      total,
      completed,
      remaining: Math.max(total - completed, 0),
      percentage,
      label: `${percentage}%`
    };
  }

  function createDashboardModel(context = {}) {
    const progress = createProgressModel(context.progress);

    return {
      title: "SSW Airport Ground Handling Exam",
      subtitle: "Study • Practice • Visual Learning • Exam Preparation",

      progress,

      quick_actions: QUICK_ACTIONS.map(action => ({
        ...action,
        enabled: action.route !== ROUTES.REAL_EXAM || context.realExamEnabled === true
      })),

      study_tracks: [
        {
          id: "GROUND_HANDLING",
          title: "Airport Ground Handling",
          enabled: context.groundHandlingEnabled !== false
        },
        {
          id: "AIRCRAFT_MAINTENANCE",
          title: "Aircraft Maintenance",
          enabled: context.aircraftMaintenanceEnabled !== false
        }
      ],

      recent_activity: Array.isArray(context.recentActivity)
        ? context.recentActivity.slice(0, 5)
        : [],

      recommended_next: context.recommendedNext || null,

      navigation: NAV_ITEMS.map(item => ({ ...item })),

      sections: DASHBOARD_SECTIONS
    };
  }

  function getNavItems(priority = null) {
    if (!priority) return NAV_ITEMS.map(item => ({ ...item }));
    return NAV_ITEMS
      .filter(item => item.priority === priority)
      .map(item => ({ ...item }));
  }

  function buildRouteModel(route, context = {}) {
    const normalized = Object.values(ROUTES).includes(route)
      ? route
      : ROUTES.HOME;

    const titles = {
      [ROUTES.HOME]: "Ground Handling Exam",
      [ROUTES.STUDY]: "Study",
      [ROUTES.MCQ]: "MCQ Practice",
      [ROUTES.OFFICIAL_SAMPLES]: "Official Samples",
      [ROUTES.VISUAL_LIBRARY]: "Visual Library",
      [ROUTES.GLOSSARY]: "Technical Terms",
      [ROUTES.SEARCH]: "Search",
      [ROUTES.PROGRESS]: "Progress",
      [ROUTES.REAL_EXAM]: "Real Exam Mode",
      [ROUTES.SETTINGS]: "Settings"
    };

    return {
      route: normalized,
      title: titles[normalized] || titles[ROUTES.HOME],
      dashboard: normalized === ROUTES.HOME
        ? createDashboardModel(context)
        : null
    };
  }

  window.SSWDashboard = {
    ROUTES,
    NAV_ITEMS,
    QUICK_ACTIONS,
    DASHBOARD_SECTIONS,
    NavigationController,
    createProgressModel,
    createDashboardModel,
    getNavItems,
    buildRouteModel
  };
})();
