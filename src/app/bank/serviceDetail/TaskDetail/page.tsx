"use client";

import { Eye } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DataGrid, type GridColDef, type GridRowParams } from "@mui/x-data-grid";
import type { TaskRow } from "@/types/domain";
import DashboardLayout from "@/components/layout/DashboardLayout";
import styles from "./page.module.css";
import TaskDetailModal from "./components/TaskDetailModal";

const TaskDetail = () => {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const handleViewClick = (task: TaskRow) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };
  const handleRowClick = (params: GridRowParams<TaskRow>) => {
    setSelectedRow(Number(params.id));
  };

  const taskData: TaskRow[] = [
    { id: 1, srNo: 1, rcNo: 1, itemsToBeDone: "Teak Wood Moulding", unit: "Sq.ft.", appQty: 192, usedQty: 100, rate: 16.5, amount: 3168, remarks: 44 },
    { id: 2, srNo: 2, rcNo: 2, itemsToBeDone: "Door frame wooden", unit: "Sq.ft.", appQty: 192, usedQty: 100, rate: 145, amount: 27840, remarks: 44 },
    { id: 3, srNo: 3, rcNo: 619, itemsToBeDone: "Glass finished partition", unit: "Sq.ft.", appQty: 192, usedQty: 100, rate: 14, amount: 7700, remarks: 7700 },
    // ... other data rows
  ];

  const columns: GridColDef<TaskRow>[] = [
    {
      field: 'srNo',
      headerName: 'Sr. No.',
      width: 92,
      headerClassName: styles.gridHeader,
      renderCell: (params) => (
        <div style={{ padding: "0 16px" }}>{String(params.value ?? "")}</div>
      ),
    },
    {
      field: 'rcNo',
      headerName: 'RC No.',
      width: 92,
      headerClassName: styles.gridHeader,
      renderCell: (params) => (
        <div style={{ padding: "0 16px" }}>{String(params.value ?? "")}</div>
      ),
    },
    {
      field: 'itemsToBeDone',
      headerName: 'Items to be done',
      width: 222,
      headerClassName: styles.gridHeader,
      renderCell: (params) => (
        <div style={{ padding: "0 16px" }}>{String(params.value ?? "")}</div>
      ),
    },
    {
      field: 'unit',
      headerName: 'Unit',
      width: 92,
      headerClassName: styles.gridHeader,
      renderCell: (params) => (
        <div style={{ padding: "0 16px" }}>{String(params.value ?? "")}</div>
      ),
    },
    {
      field: 'appQty',
      headerName: 'App. Qty',
      width: 92,
      headerClassName: styles.gridHeader,
      renderCell: (params) => (
        <div style={{ padding: "0 16px" }}>{String(params.value ?? "")}</div>
      ),
    },
    {
      field: 'usedQty',
      headerName: 'Used Qty',
      width: 92,
      headerClassName: styles.gridHeader,
      renderCell: (params) => (
        <div style={{ padding: "0 16px" }}>{String(params.value ?? "")}</div>
      ),
    },
    {
      field: 'rate',
      headerName: 'Rate',
      width: 92,
      headerClassName: styles.gridHeader,
      renderCell: (params) => (
        <div style={{ padding: "0 16px" }}>{String(params.value ?? "")}</div>
      ),
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 92,
      headerClassName: styles.gridHeader,
      renderCell: (params) => (
        <div style={{ padding: "0 16px" }}>{String(params.value ?? "")}</div>
      ),
    },
    {
      field: 'remarks',
      headerName: 'Remarks',
      width: 92,
      headerClassName: styles.gridHeader,
      renderCell: (params) => (
        <div style={{ padding: "0 16px" }}>{String(params.value ?? "")}</div>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 106,
      headerClassName: styles.gridHeader,
      renderCell: (params) => (
        <button 
          className={styles.actionButton}
          onClick={() => handleViewClick(params.row as TaskRow)}
        >
          <Eye />
        </button>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className={styles.taskDetailContainer}>
        <div className={styles.taskDetailContent}>
          <div className={styles.taskDetailHeader}>
            <button 
              onClick={() => router.back()}
              className={styles.backButton}
            >
              <FontAwesomeIcon icon={faArrowLeft} style={{color: "#0d0d0d"}} />
              <span>Task in Progress</span>
            </button>
          </div>

          <div className={styles.sectionTitle}>
            <h2>Steps</h2>
            <p>Task StartingDate: <span>13th October 2024</span></p>
          </div>

         <div className={styles.tableContainer}>
            <div style={{ height: '587px', width: '1063px', overflow: 'hidden'}}>
              <DataGrid
                rows={taskData}
                columns={columns}
                hideFooter
                onRowClick={handleRowClick}
                sx={{
                  '& .MuiDataGrid-row': {
                    cursor: 'pointer',
                  },
                  '& .MuiDataGrid-row.Mui-selected': {
                    backgroundColor: 'rgba(176, 51, 238, 1) !important',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(176, 51, 238, 0.8) !important',
                    },
                  },
                  '& .MuiDataGrid-cell': {
                    borderBottom: '1px solid rgba(208, 208, 208, 1)',
                    padding: '0 16px',
                  },
                  '& .MuiDataGrid-columnHeaders': {
                    background: 'rgba(218, 218, 241, 1)',
                    color: 'black',
                  },
                  '& .MuiDataGrid-columnHeaderTitle': {
                    fontFamily: 'var(--font-family-primary)',
                    fontSize: '16px',
                    fontWeight: 600,
                    lineHeight: '24px',
                    color: 'rgba(35, 35, 35, 1)'
                    ,
                  },
                }}
                rowSelectionModel={selectedRow ? [selectedRow] : []}
              />
            </div>
          </div>
        </div>
      </div>

      <TaskDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        taskData={selectedTask}
      />
    </DashboardLayout>
  );
};

export default TaskDetail;

