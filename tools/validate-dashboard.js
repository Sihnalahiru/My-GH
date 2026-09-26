/* BUILD-09 — Dashboard / Navigation Validator */
(function () {
  "use strict";

  function validateDashboard() {
    const errors = [];
    const warnings = [];

    if (!window.SSWDashboard) {
      errors.push("NAV-001: dashboard engine is not loaded");
      return {
        valid: false,
        errors,
        warnings
      };
    }

    const routes = Object.values(window.SSWDashboard.ROUTES);
    const navItems = window.SSWDashboard.NAV_ITEMS;

    const routeSet = new Set(routes);
    const navRouteSet = new Set();

    for (const item of navItems) {
      if (!item.id) errors.push("NAV-002: navigation item missing id");
      if (!item.route) errors.push("NAV-003: navigation item missing route");

      if (!routeSet.has(item.route)) {
        errors.push(`NAV-004: unknown navigation route ${item.route}`);
      }

      if (navRouteSet.has(item.route)) {
        errors.push(`NAV-005: duplicate navigation route ${item.route}`);
      }

      navRouteSet.add(item.route);
    }

    const model = window.SSWDashboard.createDashboardModel({
      progress: {
        total: 100,
        completed: 25
      }
    });

    if (model.progress.percentage !== 25) {
      errors.push("NAV-006: progress model calculation failed");
    }

    if (!model.quick_actions.length) {
      errors.push("NAV-007: dashboard has no quick actions");
    }

    if (!model.navigation.length) {
      errors.push("NAV-008: dashboard has no navigation");
    }

    const controller = new window.SSWDashboard.NavigationController();
    controller.start();

    if (controller.currentRoute !== window.SSWDashboard.ROUTES.HOME) {
      errors.push("NAV-009: initial route is not home");
    }

    controller.go(window.SSWDashboard.ROUTES.MCQ);

    if (controller.currentRoute !== window.SSWDashboard.ROUTES.MCQ) {
      errors.push("NAV-010: route transition failed");
    }

    controller.back();

    if (controller.currentRoute !== window.SSWDashboard.ROUTES.HOME) {
      errors.push("NAV-011: navigation back failed");
    }

    warnings.push(
      "NAV-W001: visual styling and screen markup are implemented in later UI build steps."
    );

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      counts: {
        routes: routes.length,
        navigation_items: navItems.length,
        quick_actions: window.SSWDashboard.QUICK_ACTIONS.length,
        dashboard_sections: window.SSWDashboard.DASHBOARD_SECTIONS.length
      }
    };
  }

  window.validateSSWDashboard = validateDashboard;
})();
