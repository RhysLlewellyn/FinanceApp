import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../services/authContext';
import api from '../services/api';
import {
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  InputAdornment,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Chip,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ArrowCircleDown from '@mui/icons-material/ArrowCircleDown';
import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUp';
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
} from 'recharts';
import { formatCurrency } from '../utils/currencyFormatter';
import useNotification from '../hooks/useNotification';
import AddCardIcon from '@mui/icons-material/AddCard';
import { alpha } from '@mui/material/styles';
import { TabContext, TabList, TabPanel } from '@mui/lab';

function Transactions() {
  const { isAuthenticated } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openAddCategoryDialog, setOpenAddCategoryDialog] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    date: null,
    name: '',
    amount: '',
    category: '',
    account_id: '',
  });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [transactionFilter, setTransactionFilter] = useState('all');
  const [openUpdateCategoryDialog, setOpenUpdateCategoryDialog] =
    useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [cardBalance, setCardBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessages, setErrorMessages] = useState({
    fetch: null,
    balance: null,
    transaction: null,
  });
  const { showNotification } = useNotification();
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isAccountLoading, setIsAccountLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);

  const clearError = (errorType) => {
    setErrorMessages((prev) => ({ ...prev, [errorType]: null }));
  };

  const fetchTransactions = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const response = await api.get('/stored_transactions', {
        params: {
          days_requested: 730,
          account_id: selectedAccount?.id,
        },
      });

      let filteredTransactions = [...response.data.transactions];

      // Apply account filter if selected
      if (selectedAccount) {
        filteredTransactions = filteredTransactions.filter(
          (transaction) => transaction.account_id === selectedAccount.id
        );
      }

      // Apply transaction type filter
      if (transactionFilter === 'income') {
        filteredTransactions = filteredTransactions.filter(
          (transaction) => transaction.amount > 0
        );
      } else if (transactionFilter === 'expenses') {
        filteredTransactions = filteredTransactions.filter(
          (transaction) => transaction.amount < 0
        );
      }

      // Apply date filter if selected
      if (dateRange) {
        const selectedDate = new Date(dateRange);
        filteredTransactions = filteredTransactions.filter((transaction) => {
          const transactionDate = new Date(transaction.date);
          return (
            transactionDate.getFullYear() === selectedDate.getFullYear() &&
            transactionDate.getMonth() === selectedDate.getMonth()
          );
        });
      }

      // Sort transactions by date (most recent first)
      filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

      setTransactions(filteredTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, selectedAccount, transactionFilter, dateRange]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/get_categories');
      console.log('Categories response:', response);
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('Failed to fetch categories');
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await api.get('/accounts');
      setAccounts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setError('Failed to fetch accounts');
    }
  }, []);

  const getFilteredTransactions = useCallback(() => {
    switch (transactionFilter) {
      case 'income':
        return transactions.filter((transaction) => transaction.amount >= 0);
      case 'expense':
        return transactions.filter((transaction) => transaction.amount < 0);
      default:
        return transactions;
    }
  }, [transactions, transactionFilter]);

  const fetchExpenseChartData = useCallback(async () => {
    setIsChartLoading(true);
    try {
      const response = await api.get('/stored_transactions', {
        params: {
          account_id: selectedAccount?.id,
          days_requested: 730,
        },
      });

      const accountTransactions = selectedAccount
        ? response.data.transactions.filter(
            (t) => t.account_id === selectedAccount.id
          )
        : response.data.transactions;

      // Group transactions by month and calculate total expenses
      const expensesByMonth = accountTransactions.reduce((acc, transaction) => {
        // Only include negative amounts (expenses)
        if (transaction.amount < 0) {
          const date = new Date(transaction.date);
          const monthYear = `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, '0')}`;
          acc[monthYear] = (acc[monthYear] || 0) + Math.abs(transaction.amount);
        }
        return acc;
      }, {});

      // Convert to array and sort by date
      const chartData = Object.entries(expensesByMonth)
        .map(([monthYear, amount]) => ({
          month: new Date(monthYear + '-01').toLocaleString('default', {
            month: 'short',
          }),
          amount: Number(amount.toFixed(2)),
          year: new Date(monthYear + '-01').getFullYear(), // Add year for better sorting
        }))
        .sort((a, b) => {
          // Sort by date properly
          const dateA = new Date(`${a.month} ${a.year}`);
          const dateB = new Date(`${b.month} ${b.year}`);
          return dateA - dateB;
        });

      // Take the last 6 months
      const last6Months = chartData.slice(-6);
      setChartData(last6Months);
    } catch (error) {
      console.error('Error fetching expense chart data:', error);
      setError('Failed to fetch expense chart data');
    } finally {
      setIsChartLoading(false);
    }
  }, [selectedAccount]);

  const fetchCardBalance = useCallback(async () => {
    try {
      setIsLoading(true);
      clearError('balance');
      const response = await api.get('/accounts');
      const accounts = response.data;

      if (!accounts || accounts.length === 0) {
        setErrorMessages((prev) => ({
          ...prev,
          balance: 'No accounts found. Please link an account to view balance.',
        }));
        return;
      }

      setCardBalance(accounts[0].balance);
    } catch (error) {
      const errorMessage =
        error.response?.data?.error ||
        'Failed to fetch card balance. Please try again later.';
      setErrorMessages((prev) => ({ ...prev, balance: errorMessage }));
      console.error('Error fetching card balance:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchAccounts();
    fetchCategories();
    fetchExpenseChartData();
    fetchCardBalance();
  }, [
    fetchTransactions,
    fetchAccounts,
    fetchCategories,
    fetchExpenseChartData,
    fetchCardBalance,
  ]);

  useEffect(() => {
    console.log('Categories:', categories);
  }, [categories]);

  const handleAddTransaction = async () => {
    try {
      setIsLoading(true);
      clearError('transaction');

      // Validation
      const validationErrors = validateTransaction(newTransaction);
      if (validationErrors) {
        setErrorMessages((prev) => ({
          ...prev,
          transaction: validationErrors,
        }));
        return;
      }

      const transactionToAdd = {
        ...newTransaction,
        amount: parseFloat(newTransaction.amount) || 0,
      };

      const response = await api.post('/stored_transactions', transactionToAdd);
      setTransactions([response.data, ...transactions]);
      setOpenAddDialog(false);
      resetTransactionForm();

      // Show success message using the notification context
      showNotification('Transaction added successfully');
    } catch (error) {
      const errorMessage =
        error.response?.data?.error ||
        'Failed to add transaction. Please try again.';
      setErrorMessages((prev) => ({ ...prev, transaction: errorMessage }));
      console.error('Error adding transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCategory = async (categoryName) => {
    const trimmedCategoryName = categoryName.trim();
    if (trimmedCategoryName === '') return;

    try {
      const response = await api.post('/add_custom_category', {
        name: trimmedCategoryName,
      });
      setCategories([...categories, response.data.name]);
      return response.data.name; // Return the new category name
    } catch (error) {
      console.error('Error adding category:', error);
      setError('Failed to add category. Please try again.');
      throw error; // Rethrow the error to be caught in handleCategoryUpdate
    }
  };

  const handleUpdateCategory = (transactionId) => {
    setSelectedTransactionId(transactionId);
    setOpenUpdateCategoryDialog(true);
  };

  const handleCategoryUpdate = async () => {
    if (!selectedTransactionId || !newCategory.trim()) return;

    try {
      // Check if the category already exists
      if (!categories.includes(newCategory)) {
        // If it doesn't exist, add it
        await handleAddCategory(newCategory);
      }

      // Update the transaction with the new category
      const response = await api.put(
        `/stored_transactions/${selectedTransactionId}`,
        {
          category: newCategory,
        }
      );

      if (response.status === 200) {
        setTransactions(
          transactions.map((transaction) =>
            transaction.id === selectedTransactionId
              ? { ...transaction, category: newCategory }
              : transaction
          )
        );
        setOpenUpdateCategoryDialog(false);
        setNewCategory('');
        setSelectedTransactionId(null);
      }
    } catch (error) {
      console.error('Error updating category:', error);
      setError('Failed to update category. Please try again.');
    }
  };

  const handleDownloadReceipt = async (transactionId) => {
    try {
      const response = await api.get(`/download_receipt/${transactionId}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: response.headers['content-type'],
      });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `receipt-${transactionId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      setError('Failed to download receipt. Please try again.');
    }
  };

  const columns = [
    {
      field: 'icon',
      headerName: '',
      width: 60,
      renderCell: (params) => {
        const amount = params.row.amount || 0;
        return amount >= 0 ? (
          <ArrowCircleUpIcon color="Income" />
        ) : (
          <ArrowCircleDown color="Expense" />
        );
      },
    },
    {
      field: 'name',
      headerName: 'Description',
      width: 200,
      renderCell: (params) => {
        const name = params.value || 'Unknown';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {params.row.logo_url && (
              <img
                src={params.row.logo_url}
                alt=""
                style={{
                  width: 20,
                  height: 20,
                  marginRight: 8,
                  borderRadius: '50%',
                }}
              />
            )}
            <Typography variant="body2">
              {params.row.website ? (
                <a
                  href={params.row.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {name}
                </a>
              ) : (
                name
              )}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'category',
      headerName: 'Category',
      width: 150,
      renderCell: (params) => {
        const category = params.value || 'Uncategorized';
        return (
          <Chip
            label={category}
            size="small"
            color={category === 'Uncategorized' ? 'default' : 'primary'}
            onClick={() => handleUpdateCategory(params.row.id)}
          />
        );
      },
    },
    {
      field: 'subcategory',
      headerName: 'Subcategory',
      width: 150,
      renderCell: (params) => {
        const subcategory = params.value || 'N/A';
        return <Typography variant="body2">{subcategory}</Typography>;
      },
    },
    {
      field: 'date',
      headerName: 'Date',
      width: 120,
      renderCell: (params) => {
        const date = params.value
          ? new Date(params.value).toLocaleDateString()
          : 'N/A';
        return <Typography variant="body2">{date}</Typography>;
      },
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 130,
      renderCell: (params) => (
        <Typography
          sx={{
            color: params.value >= 0 ? 'success.main' : 'error.main',
          }}
        >
          {formatCurrency(params.value, params.row.iso_currency_code)}
        </Typography>
      ),
    },
    {
      field: 'merchant_name',
      headerName: 'Merchant',
      width: 150,
      renderCell: (params) => {
        const merchantName = params.value || 'N/A';
        return <Typography variant="body2">{merchantName}</Typography>;
      },
    },
    {
      field: 'location',
      headerName: 'Location',
      width: 150,
      renderCell: (params) => {
        const location = params.row.location
          ? `${params.row.location.city || ''} ${
              params.row.location.region || ''
            } ${params.row.location.country || ''}`.trim()
          : 'N/A';
        return <Typography variant="body2">{location}</Typography>;
      },
    },
    {
      field: 'payment_channel',
      headerName: 'Payment Channel',
      width: 150,
      renderCell: (params) => {
        const paymentChannel = params.value
          ? params.value.charAt(0).toUpperCase() + params.value.slice(1)
          : 'N/A';
        return <Typography variant="body2">{paymentChannel}</Typography>;
      },
    },
    {
      field: 'pending',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => {
        const status = params.value ? 'Pending' : 'Completed';
        return (
          <Chip
            label={status}
            size="small"
            color={params.value ? 'warning' : 'success'}
          />
        );
      },
    },
    {
      field: 'receipt',
      headerName: 'Receipt',
      width: 120,
      renderCell: (params) => (
        <Button
          variant="outlined"
          size="small"
          onClick={() => handleDownloadReceipt(params.row.id)}
        >
          Download
        </Button>
      ),
    },
  ];

  // Add validation function
  const validateTransaction = (transaction) => {
    if (!transaction.date) return 'Date is required';
    if (!transaction.name?.trim()) return 'Name is required';
    if (!transaction.amount) return 'Amount is required';
    if (!transaction.account_id) return 'Account is required';

    const amount = parseFloat(transaction.amount);
    if (isNaN(amount) || amount === 0) return 'Please enter a valid amount';

    return null;
  };

  // Add reset form function
  const resetTransactionForm = () => {
    setNewTransaction({
      date: null,
      name: '',
      amount: '',
      category: '',
      account_id: '',
    });
  };

  // Add error display component
  const ErrorMessage = ({ error, onClose }) => {
    if (!error) return null;

    return (
      <Alert severity="error" onClose={onClose} sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  };

  const handleAccountSelect = async (account) => {
    setIsAccountLoading(true);
    setSelectedAccount(account);
    setTransactionFilter('all');

    try {
      await Promise.all([fetchTransactions(), fetchExpenseChartData()]);
    } finally {
      setIsAccountLoading(false);
    }
  };

  // Add this new section to show when no specific account is selected
  const renderAccountSummary = () => (
    <Box
      sx={{
        mt: 3,
        p: 3,
        background: 'linear-gradient(135deg, #f8f9fe 0%, #f5f5f5 100%)',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{ color: 'text.secondary', mb: 2, letterSpacing: '0.5px' }}
      >
        ACCOUNTS SUMMARY
      </Typography>

      {/* Stats Section */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box sx={{ flex: '1 1 calc(50% - 8px)' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            Total Accounts
          </Typography>
          <Typography
            variant="h5"
            sx={{ color: 'primary.main', fontWeight: 'bold' }}
          >
            {accounts.length}
          </Typography>
        </Box>

        <Box sx={{ flex: '1 1 calc(50% - 8px)' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            Total Balance
          </Typography>
          <Typography
            variant="h5"
            sx={{ color: 'primary.main', fontWeight: 'bold' }}
          >
            {formatCurrency(
              accounts.reduce((total, account) => total + account.balance, 0),
              'GBP'
            )}
          </Typography>
        </Box>

        <Box sx={{ flex: '1 1 calc(50% - 8px)' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            Highest Balance
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: 'success.main', fontWeight: 'medium' }}
          >
            {formatCurrency(
              Math.max(...accounts.map((acc) => acc.balance)),
              'GBP'
            )}
          </Typography>
        </Box>

        <Box sx={{ flex: '1 1 calc(50% - 8px)' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            Monthly Expenses
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: '#FF69B4', fontWeight: 'medium' }}
          >
            {formatCurrency(
              chartData.length > 0 ? chartData[chartData.length - 1].amount : 0,
              'GBP'
            )}
          </Typography>
        </Box>
      </Box>

      {/* Account List Preview */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          LINKED ACCOUNTS
        </Typography>
        {accounts.map((account, index) => (
          <Box
            key={account.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 1,
              borderBottom: index < accounts.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: (theme) =>
                    alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: 'primary.main', fontWeight: 'bold' }}
                >
                  {account.name.charAt(0)}
                </Typography>
              </Box>
              <Typography variant="body2">{account.name}</Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              {formatCurrency(account.balance, account.iso_currency_code)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );

  // Update the renderAccountsSection to include the summary
  const renderAccountsSection = () => (
    <Card
      sx={{
        flexGrow: 1,
        maxWidth: 400,
        background: 'linear-gradient(135deg, #fff 0%, #f5f5f5 100%)',
        borderRadius: 4,
        boxShadow: (theme) =>
          `0 2px 16px ${alpha(theme.palette.primary.main, 0.1)}`,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <FormControl
          fullWidth
          variant="outlined"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: 'white',
              '&:hover': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
              },
            },
          }}
        >
          <Select
            value={selectedAccount?.id || ''}
            onChange={(e) => {
              const account = accounts.find((acc) => acc.id === e.target.value);
              handleAccountSelect(account);
            }}
            displayEmpty
            renderValue={(selected) => {
              if (!selected) {
                return (
                  <Typography sx={{ color: 'text.secondary' }}>
                    All Accounts
                  </Typography>
                );
              }
              const account = accounts.find((acc) => acc.id === selected);
              return account?.name;
            }}
            disabled={isAccountLoading}
          >
            <MenuItem value="">All Accounts</MenuItem>
            {accounts.map((account) => (
              <MenuItem
                key={account.id}
                value={account.id}
                sx={{
                  py: 1.5,
                  '&:hover': {
                    backgroundColor: alpha('#000', 0.02),
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: (theme) =>
                          alpha(theme.palette.primary.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 2,
                      }}
                    >
                      <Typography
                        sx={{ color: 'primary.main', fontWeight: 'bold' }}
                      >
                        {account.name.charAt(0)}
                      </Typography>
                    </Box>
                    <Typography>{account.name}</Typography>
                  </Box>
                  <Typography
                    sx={{
                      ml: 2,
                      color: 'text.primary',
                      fontWeight: 'medium',
                    }}
                  >
                    {formatCurrency(account.balance, account.iso_currency_code)}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Account Details Card - Works for both All Accounts and individual accounts */}
        <Box
          sx={{
            mt: 3,
            p: 3,
            background: 'linear-gradient(135deg, #4318FF 0%, #6B73FF 100%)',
            color: 'white',
            borderRadius: 3,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {isAccountLoading && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
              }}
            >
              <LinearProgress
                sx={{
                  bgcolor: 'transparent',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: 'white',
                  },
                }}
              />
            </Box>
          )}

          <Typography
            variant="subtitle2"
            sx={{ opacity: 0.8, letterSpacing: '0.5px' }}
          >
            {selectedAccount ? 'SELECTED ACCOUNT' : 'ALL ACCOUNTS'}
          </Typography>
          <Typography
            variant="h5"
            sx={{
              my: 1,
              fontWeight: 'bold',
              opacity: isAccountLoading ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {selectedAccount ? selectedAccount.name : 'Total Balance'}
          </Typography>
          <Typography
            variant="h4"
            sx={{
              mb: 2,
              fontWeight: 'bold',
              opacity: isAccountLoading ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {formatCurrency(
              selectedAccount
                ? selectedAccount.balance
                : accounts.reduce(
                    (total, account) => total + account.balance,
                    0
                  ),
              selectedAccount?.iso_currency_code || 'GBP'
            )}
          </Typography>
          {selectedAccount && (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              **** **** **** {selectedAccount.mask || '1234'}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  const renderExpensesSection = () => (
    <Card
      sx={{
        flexGrow: 1,
        minWidth: 300,
        background: 'linear-gradient(135deg, #fff 0%, #f5f5f5 100%)',
        borderRadius: 4,
        boxShadow: (theme) =>
          `0 2px 16px ${alpha(theme.palette.primary.main, 0.1)}`,
        position: 'relative',
      }}
    >
      {isChartLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(255, 255, 255, 0.7)',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
          }}
        >
          <CircularProgress />
        </Box>
      )}
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="subtitle2"
            sx={{
              color: 'text.secondary',
              mb: 1,
              letterSpacing: '0.5px',
            }}
          >
            {selectedAccount
              ? `${selectedAccount.name.toUpperCase()} EXPENSES`
              : 'TOTAL EXPENSES'}
          </Typography>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 'bold',
              color: 'text.primary',
            }}
          >
            {formatCurrency(
              chartData.reduce((total, data) => total + data.amount, 0),
              selectedAccount?.iso_currency_code || 'GBP'
            )}
          </Typography>
        </Box>

        <Box sx={{ height: 300, width: '100%', mt: 4 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `£${value}`}
                dx={-10}
              />
              <Tooltip
                formatter={(value) =>
                  formatCurrency(
                    value,
                    selectedAccount?.iso_currency_code || 'GBP'
                  )
                }
                labelFormatter={(label) => label}
                contentStyle={{
                  borderRadius: 8,
                  border: 'none',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Bar dataKey="amount" fill="#FF69B4" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );

  const renderTransactionFilters = () => (
    <Card
      sx={{
        mb: 3,
        borderRadius: 4,
        boxShadow: (theme) =>
          `0 2px 16px ${alpha(theme.palette.primary.main, 0.1)}`,
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TabContext value={transactionFilter}>
            <TabList
              onChange={(_, newValue) => setTransactionFilter(newValue)}
              sx={{
                minHeight: '40px',
                '& .MuiTab-root': {
                  minHeight: '40px',
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  px: 3,
                },
              }}
            >
              <Tab
                label="All Transactions"
                value="all"
                sx={{ borderRadius: '20px' }}
              />
              <Tab
                label="Income"
                value="income"
                sx={{ borderRadius: '20px' }}
              />
              <Tab
                label="Expenses"
                value="expenses"
                sx={{ borderRadius: '20px' }}
              />
            </TabList>
          </TabContext>

          {/* Month Picker */}
          <Box sx={{ ml: 'auto' }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Select Month"
                views={['year', 'month']}
                value={dateRange}
                onChange={(newValue) => setDateRange(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'white',
                      },
                    }}
                  />
                )}
              />
            </LocalizationProvider>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const renderTransactionsGrid = () => (
    <Card
      sx={{
        height: 600,
        borderRadius: 4,
        boxShadow: (theme) =>
          `0 2px 16px ${alpha(theme.palette.primary.main, 0.1)}`,
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {transactionFilter !== 'all' && (
            <Chip
              label={`${
                transactionFilter === 'income' ? 'Income' : 'Expenses'
              } Only`}
              onDelete={() => setTransactionFilter('all')}
              size="small"
              sx={{
                backgroundColor:
                  transactionFilter === 'income'
                    ? alpha('#4CAF50', 0.1) // Green background for income
                    : alpha('#FF3B3B', 0.1), // Red background for expenses
                color: transactionFilter === 'income' ? '#4CAF50' : '#FF3B3B',
                fontWeight: 500,
                '& .MuiChip-deleteIcon': {
                  color: transactionFilter === 'income' ? '#4CAF50' : '#FF3B3B',
                  '&:hover': {
                    opacity: 0.7,
                  },
                },
              }}
            />
          )}
          {dateRange && (
            <Chip
              label={`${new Date(dateRange).toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
              })}`}
              onDelete={() => setDateRange(null)}
              size="small"
              sx={{
                backgroundColor: alpha('#4318FF', 0.1), // Purple background
                color: '#4318FF',
                fontWeight: 500,
                '& .MuiChip-deleteIcon': {
                  color: '#4318FF',
                  '&:hover': {
                    opacity: 0.7,
                  },
                },
              }}
            />
          )}
          {(transactionFilter !== 'all' || dateRange) && (
            <Button
              size="small"
              onClick={clearFilters}
              sx={{
                ml: 'auto',
                color: '#4318FF',
                '&:hover': {
                  backgroundColor: alpha('#4318FF', 0.05),
                },
              }}
            >
              Clear Filters
            </Button>
          )}
        </Box>
      </Box>
      <DataGrid
        rows={transactions}
        columns={columns}
        pageSize={10}
        rowsPerPageOptions={[10, 25, 50]}
        checkboxSelection={false}
        disableSelectionOnClick
        loading={loading}
        components={{
          LoadingOverlay: CustomLoadingOverlay,
          Toolbar: GridToolbar,
        }}
        componentsProps={{
          toolbar: {
            sx: {
              '& .MuiButton-root': {
                color: 'primary.main',
              },
            },
          },
        }}
        sx={{
          '& .income-row': {
            color: 'success.main',
          },
          '& .expense-row': {
            color: '#FF69B4',
          },
        }}
      />
    </Card>
  );

  const CustomLoadingOverlay = () => (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
      }}
    >
      <CircularProgress size={40} />
      <Typography sx={{ mt: 2 }}>Loading Transactions...</Typography>
    </Box>
  );

  const clearFilters = () => {
    setTransactionFilter('all');
    setDateRange(null);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Transactions
        </Typography>

        <Box
          sx={{
            display: 'flex',
            gap: 3,
            mb: 4,
            flexWrap: { xs: 'wrap', lg: 'nowrap' },
          }}
        >
          {renderAccountsSection()}
          {renderExpensesSection()}
        </Box>

        {renderTransactionFilters()}
        {renderTransactionsGrid()}
      </Box>
    </LocalizationProvider>
  );
}

export default Transactions;
