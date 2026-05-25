enum AppRole { admin, manager, employee, executive }

AppRole roleFromString(String? value) {
  switch (value) {
    case 'admin':
      return AppRole.admin;
    case 'manager':
      return AppRole.manager;
    case 'executive':
      return AppRole.executive;
    case 'employee':
    default:
      return AppRole.employee;
  }
}

extension AppRoleX on AppRole {
  bool get isHr => this == AppRole.admin || this == AppRole.executive;
  bool get canManage => this == AppRole.manager || isHr;

  String get label {
    switch (this) {
      case AppRole.admin:
        return 'HR Admin';
      case AppRole.manager:
        return 'Manager';
      case AppRole.executive:
        return 'Executive';
      case AppRole.employee:
        return 'Employee';
    }
  }
}
