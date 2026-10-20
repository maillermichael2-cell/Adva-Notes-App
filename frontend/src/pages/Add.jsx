import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom'; 

const Add = () => {
    // 1. Intercept URL configuration params to detect Mode
    const { id } = useParams();
    const isEditMode = Boolean(id);

    // 2. Setup structural state fields
    const [notes_name, setNotes_Name] = useState('');
    const [notes, setNotes] = useState('');
    const [initialLoading, setInitialLoading] = useState(isEditMode); // True on startup if editing
    const [loading, setLoading] = useState(false); // Controls form submission blockout
    const [error, setError] = useState(null);
    
    const navigate = useNavigate(); 

    // 3. RETRIEVE: Fetch data from Django database if editing on mount
    useEffect(() => {
        if (!isEditMode) return;

        const fetchNoteDetails = async () => {
            try {
                const response = await fetch(`http://localhost:8080/api/V1/notes/${id}/`);
                if (!response.ok) {
                    throw new Error(`Could not locate entry data. Status: ${response.status}`);
                }
                const result = await response.json();
                setNotes_Name(result.notes_name);
                setNotes(result.notes);
            } catch (err) {
                setError(err.message);
            } finally {
                setInitialLoading(false);
            }
        };

        fetchNoteDetails();
    }, [id, isEditMode]);

    // 4. Handle the Form Submit action (Handles both POST and PUT)
    const handleSubmit = async (e) => {
        e.preventDefault(); 
        setLoading(true);
        setError(null);

        const payload = { notes_name: notes_name, notes: notes };
        
        // Dynamically shift endpoint paths and REST action keywords
        const apiUrl = isEditMode ? `http://localhost:8080/api/V1/notes/${id}/` : 'http://localhost:8080/api/V1/notes/';
        const apiMethod = isEditMode ? 'PUT' : 'POST';

        try {
            const response = await fetch(apiUrl, {
                method: apiMethod,
                headers: {
                    'Content-Type': 'application/json', 
                },
                body: JSON.stringify(payload), 
            });

            if (!response.ok) {
                throw new Error(`Server Error: status code ${response.status}`);
            }

            const result = await response.json(); 
            console.log(`Successfully updated in Django via ${apiMethod}:`, result);

            navigate('/'); 

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Render loading indicator shell while initial data is being pulled from Django database
    if (initialLoading) {
        return <div className="add"><h1>Syncing system data...</h1></div>;
    }

    return (
        <div className="add">
            {/* Dynamic Header Label adjustments */}
            <h1>{isEditMode ? 'Modify Notes Details' : 'Add New Notes'}</h1>

            <Link to="/" className="link">
                Home
            </Link>
            
            {error && <div className="error-message">Failed to save: {error}</div>}
            
            <form className="addForm" onSubmit={handleSubmit}>

                <input 
                    type="text" 
                    id="name" 
                    name="notes_name" 
                    placeholder="Enter notes title..."
                    value={notes_name}
                    onChange={(e) => setNotes_Name(e.target.value)} 
                    required 
                    disabled={loading}
                    autoComplete="off"
                    className="plainTitleInput"
                />
        

                <textarea 
                    id="description" 
                    name="notes" 
                    value={notes}
                    placeholder="Enter your notes here..."
                    onChange={(e) => setNotes(e.target.value)} 
                    required
                    disabled={loading}
                    className="plainTextArea"
                ></textarea>
                
                {/* Dynamic Button UI String feedback mapping */}
                <button type="submit" disabled={loading}>
                    {loading ? 'Processing...' : isEditMode ? 'Save Changes' : 'Add Notes'}
                </button>
            </form>
        </div>
    );
};

export default Add;
