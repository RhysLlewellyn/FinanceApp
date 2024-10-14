import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import api from '../services/api';
import { formatCurrency } from '../utils/currencyFormatter';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  CircularProgress,
  Button,
  Snackbar,
  Alert,
  TablePagination,
  TableSortLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Collapse,
  Typography,
  InputAdornment,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddIcon from '@mui/icons-material/Add';

function Transactions() {
  const { isAuthenticated } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingCategory, setEditingCategory] = useState('');
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setOrderBy] = useState('date');
  const [order, setOrder] = useState('desc');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [bulkEditCategory, setBulkEditCategory] = useState('');
  const [openBulkEditDialog, setOpenBulkEditDialog] = useState(false);
  const [categories, setCategories] = useState([]);
  const [newTransaction, setNewTransaction] = useState({
    date: '',
    name: '',
    amount: '',
    category: '',
    account_id: '',
  });
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountFilter, setAccountFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [openAddCategoryDialog, setOpenAddCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const fetchTransactions = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const response = await api.get('/stored_transactions', {
        params: {
          page: page + 1,
          per_page: rowsPerPage,
          order_by: orderBy,
          order: order,
          start_date: startDate ? startDate.format('YYYY-MM-DD') : undefined,
          end_date: endDate ? endDate.format('YYYY-MM-DD') : undefined,
          category: categoryFilter,
          account_id: accountFilter,
        },
      });
      setTransactions(response.data.transactions);
      setTotalTransactions(response.data.total);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to fetch transactions');
      setLoading(false);
    }
  }, [
    isAuthenticated,
    page,
    rowsPerPage,
    orderBy,
    order,
    startDate,
    endDate,
    categoryFilter,
    accountFilter,
  ]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        const response = await api.get('/accounts');
        setAccounts(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Error fetching accounts:', error);
        setError('Failed to fetch accounts');
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  const handleBulkCategoryChange = async () => {
    try {
      await api.put('/stored_transactions/bulk_update', {
        transaction_ids: selectedTransactions,
        category: bulkEditCategory,
      });
      setTransactions(
        transactions.map((t) =>
          selectedTransactions.includes(t.id)
            ? { ...t, category: bulkEditCategory }
            : t
        )
      );
      setSelectedTransactions([]);
      setBulkEditCategory('');
      setOpenBulkEditDialog(false);
      fetchTransactions();
    } catch (error) {
      console.error('Error updating transaction categories in bulk:', error);
      setError('Failed to update transaction categories. Please try again.');
    }
  };

  const handleAddCategory = async () => {
    if (newCategoryName.trim() === '') return;
    try {
      const response = await api.post('/add_custom_category', {
        name: newCategoryName,
      });
      setCategories((prevCategories) => [
        ...prevCategories,
        response.data.name,
      ]);
      setNewCategoryName('');
      setOpenAddCategoryDialog(false);
    } catch (error) {
      console.error('Error adding category:', error);
      setError('Failed to add category. Please try again.');
    }
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCloseError = () => {
    setError(null);
  };

  const handleAddTransaction = async () => {
    if (
      !newTransaction.date ||
      !newTransaction.name ||
      !newTransaction.amount ||
      !newTransaction.account_id
    ) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const response = await api.post('/stored_transactions', newTransaction);
      setTransactions([response.data, ...transactions]);
      setNewTransaction({
        date: '',
        name: '',
        amount: '',
        category: '',
        account_id: '',
      });
      setOpenAddDialog(false);

      // Refresh account information
      fetchAccountInfo(newTransaction.account_id);

      // Refresh transactions list
      fetchTransactions();
    } catch (error) {
      console.error(
        'Error adding transaction:',
        error.response?.data || error.message
      );
      setError('Failed to add transaction');
    }
  };

  const fetchAccountInfo = async (accountId) => {
    try {
      const response = await api.get(`/accounts/${accountId}`);
      // Update account information in your state or context
      updateAccountInfo(response.data);
    } catch (error) {
      console.error('Error fetching account info:', error);
    }
  };

  const handleApplyFilters = () => {
    // Reset the page to 1 when applying new filters
    setPage(0);
    fetchTransactions();
  };

  const handleResetFilters = () => {
    // Reset all filter states to their initial values
    setStartDate(null);
    setEndDate(null);
    setCategoryFilter('');
    // Reset the page to 1
    setPage(0);
    // Fetch transactions with reset filters
    fetchTransactions();
  };

  const updateAccountInfo = (accountData) => {
    setAccounts((prevAccounts) => ({
      ...prevAccounts,
      [accountData.id]: accountData,
    }));
  };

  const handleCategoryChange = async (transactionId, newCategory) => {
    try {
      await api.put(`/stored_transactions/${transactionId}`, {
        category: newCategory,
      });
      setTransactions(
        transactions.map((t) =>
          t.id === transactionId ? { ...t, category: newCategory } : t
        )
      );
      setEditingId(null);
    } catch (error) {
      console.error('Error updating transaction category:', error);
      setError('Failed to update transaction category');
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/get_categories');
        setCategories(response.data);
      } catch (error) {
        console.error('Error fetching categories:', error);
        setError('Failed to fetch categories');
      }
    };

    fetchCategories();
  }, []);

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <>
        <Box>
          <Button
            startIcon={<FilterListIcon />}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setOpenAddDialog(true)}
          >
            Add Transaction
          </Button>
          {selectedTransactions.length > 0 && (
            <Button onClick={() => setOpenBulkEditDialog(true)}>
              Bulk Edit ({selectedTransactions.length})
            </Button>
          )}
          <Collapse in={showFilters}>
            <Box display="flex" flexDirection="row" alignItems="center" gap={2}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
              />
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
              />
              <FormControl fullWidth>
                <InputLabel id="category-filter-label">Category</InputLabel>
                <Select
                  labelId="category-filter-label"
                  id="category-filter"
                  value={categoryFilter}
                  label="Category"
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <MenuItem key="all" value="">
                    <em>All Categories</em>
                  </MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl style={{ minWidth: 120 }}>
                <InputLabel id="account-filter-label" shrink>
                  Account
                </InputLabel>
                <Select
                  labelId="account-filter-label"
                  id="account-filter"
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                  label="Account"
                >
                  <MenuItem value="">All</MenuItem>
                  {Array.isArray(accounts) && accounts.length > 0 ? (
                    accounts.map((account) => (
                      <MenuItem key={account.id} value={account.id}>
                        {account.name}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="" disabled>
                      No accounts available
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setOpenAddCategoryDialog(true)}
              >
                ADD CATEGORY
              </Button>
              <Button variant="contained" onClick={handleApplyFilters}>
                Apply Filters
              </Button>
              <Button variant="outlined" onClick={handleResetFilters}>
                Reset Filters
              </Button>
            </Box>
          </Collapse>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={
                        selectedTransactions.length > 0 &&
                        selectedTransactions.length < transactions.length
                      }
                      checked={
                        transactions.length > 0 &&
                        selectedTransactions.length === transactions.length
                      }
                      onChange={(event) =>
                        setSelectedTransactions(
                          event.target.checked
                            ? transactions.map((t) => t.id)
                            : []
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'date'}
                      direction={orderBy === 'date' ? order : 'asc'}
                      onClick={() => handleRequestSort('date')}
                    >
                      Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'amount'}
                      direction={orderBy === 'amount' ? order : 'asc'}
                      onClick={() => handleRequestSort('amount')}
                    >
                      Amount
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedTransactions.includes(transaction.id)}
                        onChange={(event) =>
                          setSelectedTransactions(
                            event.target.checked
                              ? [...selectedTransactions, transaction.id]
                              : selectedTransactions.filter(
                                  (id) => id !== transaction.id
                                )
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {dayjs(transaction.date).format('YYYY-MM-DD')}
                    </TableCell>
                    <TableCell>{transaction.name}</TableCell>
                    <TableCell>
                      {transaction.amount !== undefined
                        ? formatCurrency(transaction.amount)
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {editingId === transaction.id ? (
                        <TextField
                          value={editingCategory}
                          onChange={(e) => setEditingCategory(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleCategoryChange(
                                transaction.id,
                                editingCategory
                              );
                            }
                          }}
                        />
                      ) : (
                        transaction.category || 'Uncategorized'
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === transaction.id ? (
                        <>
                          <IconButton
                            onClick={() =>
                              handleCategoryChange(
                                transaction.id,
                                editingCategory
                              )
                            }
                          >
                            <CheckIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => {
                              setEditingId(null);
                              setEditingCategory('');
                            }}
                          >
                            <CloseIcon />
                          </IconButton>
                        </>
                      ) : (
                        <IconButton
                          onClick={() => {
                            setEditingId(transaction.id);
                            setEditingCategory(transaction.category || '');
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalTransactions}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
          <Snackbar
            open={!!error}
            autoHideDuration={6000}
            onClose={handleCloseError}
          >
            <Alert onClose={handleCloseError} severity="error">
              {error}
            </Alert>
          </Snackbar>
          <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
            <DialogTitle id="form-dialog-title">
              Add New Transaction
            </DialogTitle>
            <DialogContent>
              <TextField
                label="Date"
                type="date"
                value={newTransaction.date}
                onChange={(e) =>
                  setNewTransaction({ ...newTransaction, date: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Description"
                value={newTransaction.name}
                onChange={(e) =>
                  setNewTransaction({ ...newTransaction, name: e.target.value })
                }
                fullWidth
                margin="normal"
              />
              <TextField
                label="Amount"
                type="number"
                value={newTransaction.amount}
                onChange={(e) =>
                  setNewTransaction({
                    ...newTransaction,
                    amount: e.target.value,
                  })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">£</InputAdornment>
                  ),
                }}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Category"
                value={newTransaction.category}
                onChange={(e) =>
                  setNewTransaction({
                    ...newTransaction,
                    category: e.target.value,
                  })
                }
                fullWidth
                margin="normal"
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Account</InputLabel>
                <Select
                  value={newTransaction.account_id}
                  onChange={(e) =>
                    setNewTransaction({
                      ...newTransaction,
                      account_id: e.target.value,
                    })
                  }
                >
                  {Array.isArray(accounts) &&
                    accounts.map((account) => (
                      <MenuItem key={account.id} value={account.id}>
                        {account.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
              <Button onClick={handleAddTransaction}>Add</Button>
            </DialogActions>
          </Dialog>
        </Box>
        {/* Add Category Dialog */}
        <Dialog
          open={openAddCategoryDialog}
          onClose={() => setOpenAddCategoryDialog(false)}
        >
          <DialogTitle>Add New Category</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Category Name"
              type="text"
              fullWidth
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAddCategoryDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCategory}>Add</Button>
          </DialogActions>
        </Dialog>
      </>
    </LocalizationProvider>
  );
}

export default Transactions;
