/**
 * Table Dropdowns feature - dropdown selectors for markdown table cells.
 */

export type {
	TableDropdownDefinition,
	TableDropdownDefinitions,
	RawTableDropdownYAML,
	TableCellContext,
	CellPosition,
	ParsedTable,
	TableDropdownManagerEvent,
} from './types';

export {
	parseTablesFromMarkdown,
	findTableContainingLine,
	getCellPosition,
	getHeaderCellPosition,
	parseCellsFromRow,
	parseTableAtLine,
} from './TableParser';

export type { ColumnAlignment, ParsedTableWithAlignment } from './TableParser';

export {
	updateTableCell,
	updateTableCells,
	formatCellValue,
	escapePipes,
	parseMultiValue,
	preserveAlignment,
	getCellContent,
} from './TablePersistence';

export type { CellUpdate } from './TablePersistence';

export { TableDropdownAdapter } from './TableDropdownAdapter';
export type { InteractionCallback } from './TableDropdownAdapter';

export { TableDropdownCoordinator } from './TableDropdownCoordinator';

export { TableDropdownWidget } from './TableDropdownWidget';
export type { TableDropdownWidgetConfig } from './TableDropdownWidget';

export {
	registerReadingViewTableDropdowns,
	clearReadingViewAdapters,
	refreshReadingViewDropdowns,
} from './ReadingViewTableDropdowns';

export {
	LivePreviewTableDropdownManager,
	registerLivePreviewTableDropdowns,
} from './LivePreviewTableDropdowns';
