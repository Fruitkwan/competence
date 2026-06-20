import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth_controller.dart';
import '../../core/role.dart';
import '../../data/models/employee.dart';
import '../../data/repositories/employee_repository.dart';
import '../../shared/widgets/async_value_view.dart';
import '../../shared/widgets/status_chip.dart';

class _DirState {
  const _DirState({
    this.filter = const EmployeeFilter(),
    this.page = 1,
    this.pageSize = 25,
  });

  final EmployeeFilter filter;
  final int page;
  final int pageSize;

  _DirState copyWith({EmployeeFilter? filter, int? page, int? pageSize}) =>
      _DirState(
        filter: filter ?? this.filter,
        page: page ?? this.page,
        pageSize: pageSize ?? this.pageSize,
      );
}

final _dirStateProvider =
    StateProvider<_DirState>((ref) => const _DirState());

final _dirResultProvider = FutureProvider<EmployeesPage>((ref) {
  final state = ref.watch(_dirStateProvider);
  return ref.watch(employeeRepositoryProvider).list(
        filter: state.filter,
        page: state.page,
        pageSize: state.pageSize,
      );
});

class EmployeesDirectoryPage extends ConsumerWidget {
  const EmployeesDirectoryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(currentRoleProvider);
    if (!role.canManage) {
      return Scaffold(
        appBar: AppBar(title: const Text('Employees')),
        body: const EmptyState(
          icon: Icons.lock_outline,
          message: 'You do not have access to the directory.',
        ),
      );
    }
    final state = ref.watch(_dirStateProvider);
    final result = ref.watch(_dirResultProvider);
    final countries = ref.watch(countriesProvider).valueOrNull ?? const [];
    final departments =
        ref.watch(departmentsProvider).valueOrNull ?? const [];
    final jobs = ref.watch(jobsProvider).valueOrNull ?? const [];

    return Scaffold(
      appBar: AppBar(title: const Text('Employee directory')),
      body: Column(
        children: [
          _FilterBar(
            state: state,
            countries: countries,
            departments: departments,
            jobs: jobs,
            onChanged: (next) =>
                ref.read(_dirStateProvider.notifier).state = next,
          ),
          Expanded(
            child: AsyncValueView<EmployeesPage>(
              value: result,
              data: (page) {
                if (page.items.isEmpty) {
                  return const EmptyState(
                    icon: Icons.search_off,
                    message: 'No employees match the current filters.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(_dirResultProvider),
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: page.items.length,
                    itemBuilder: (context, i) =>
                        _EmployeeTile(employee: page.items[i]),
                  ),
                );
              },
            ),
          ),
          _Pagination(
            state: state,
            total: result.valueOrNull?.total ?? 0,
            totalPages: result.valueOrNull?.totalPages ?? 1,
            onChanged: (next) =>
                ref.read(_dirStateProvider.notifier).state = next,
          ),
        ],
      ),
    );
  }
}

class _FilterBar extends StatefulWidget {
  const _FilterBar({
    required this.state,
    required this.countries,
    required this.departments,
    required this.jobs,
    required this.onChanged,
  });
  final _DirState state;
  final List<String> countries;
  final List<String> departments;
  final List<String> jobs;
  final ValueChanged<_DirState> onChanged;

  @override
  State<_FilterBar> createState() => _FilterBarState();
}

class _FilterBarState extends State<_FilterBar> {
  final _q = TextEditingController();

  @override
  void initState() {
    super.initState();
    _q.text = widget.state.filter.query;
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filter = widget.state.filter;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Column(
        children: [
          TextField(
            controller: _q,
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              hintText: 'Search ID, name, email, title…',
              suffixIcon: _q.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () {
                        _q.clear();
                        widget.onChanged(widget.state.copyWith(
                          filter: filter.copyWith(query: ''),
                          page: 1,
                        ));
                      },
                    ),
            ),
            onSubmitted: (v) => widget.onChanged(widget.state.copyWith(
              filter: filter.copyWith(query: v.trim()),
              page: 1,
            )),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String?>(
            value: filter.department,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Department'),
            items: [
              const DropdownMenuItem(value: null, child: Text('All')),
              for (final d in widget.departments)
                DropdownMenuItem(value: d, child: Text(d)),
            ],
            onChanged: (v) => widget.onChanged(widget.state.copyWith(
              filter: filter.copyWith(
                department: v,
                clearDepartment: v == null,
              ),
              page: 1,
            )),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String?>(
                  value: filter.country,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Country'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('All')),
                    for (final c in widget.countries)
                      DropdownMenuItem(value: c, child: Text(c)),
                  ],
                  onChanged: (v) => widget.onChanged(widget.state.copyWith(
                    filter: filter.copyWith(
                      country: v,
                      clearCountry: v == null,
                    ),
                    page: 1,
                  )),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonFormField<String?>(
                  value: filter.status,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Status'),
                  items: const [
                    DropdownMenuItem(value: null, child: Text('All')),
                    DropdownMenuItem(value: 'active', child: Text('Active')),
                    DropdownMenuItem(value: 'inactive', child: Text('Inactive')),
                  ],
                  onChanged: (v) => widget.onChanged(widget.state.copyWith(
                    filter: filter.copyWith(
                      status: v,
                      clearStatus: v == null,
                    ),
                    page: 1,
                  )),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String?>(
            value: filter.job,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Job title'),
            items: [
              const DropdownMenuItem(value: null, child: Text('All')),
              for (final j in widget.jobs)
                DropdownMenuItem(value: j, child: Text(j)),
            ],
            onChanged: (v) => widget.onChanged(widget.state.copyWith(
              filter: filter.copyWith(job: v, clearJob: v == null),
              page: 1,
            )),
          ),
        ],
      ),
    );
  }
}

class _EmployeeTile extends StatelessWidget {
  const _EmployeeTile({required this.employee});
  final Employee employee;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: ListTile(
        title: Text(employee.fullName),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(employee.jobTitle),
            if (employee.department != null)
              Text(employee.department!,
                  style: Theme.of(context).textTheme.bodySmall),
            if (employee.email != null)
              Text(employee.email!,
                  style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
        trailing: StatusChip(
          employee.active ? 'Active' : 'Inactive',
          tone: employee.active ? StatusTone.success : StatusTone.neutral,
        ),
      ),
    );
  }
}

class _Pagination extends StatelessWidget {
  const _Pagination({
    required this.state,
    required this.total,
    required this.totalPages,
    required this.onChanged,
  });
  final _DirState state;
  final int total;
  final int totalPages;
  final ValueChanged<_DirState> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          DropdownButton<int>(
            value: state.pageSize,
            items: const [
              DropdownMenuItem(value: 10, child: Text('10 / page')),
              DropdownMenuItem(value: 25, child: Text('25 / page')),
              DropdownMenuItem(value: 50, child: Text('50 / page')),
              DropdownMenuItem(value: 100, child: Text('100 / page')),
            ],
            onChanged: (v) {
              if (v != null) onChanged(state.copyWith(pageSize: v, page: 1));
            },
          ),
          const Spacer(),
          IconButton(
            onPressed: state.page > 1
                ? () => onChanged(state.copyWith(page: state.page - 1))
                : null,
            icon: const Icon(Icons.chevron_left),
          ),
          Text(
            total == 0
                ? '0 of 0'
                : 'Page ${state.page} of $totalPages · $total total',
          ),
          IconButton(
            onPressed: state.page < totalPages
                ? () => onChanged(state.copyWith(page: state.page + 1))
                : null,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}
