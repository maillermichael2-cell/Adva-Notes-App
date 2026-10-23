import React, {useState, useEffect} from 'react';
import {Link} from 'react-router-dom';

const NotePage = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Define async function inside the useEffect hook
        const fetchData = async () => {
            try{
                const response = await fetch('http://localhost:8080/api/V1/notes/');
                
                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`)
                }

                const result = await response.json();
                setData(result); // save the data to state
            } catch (err){
                setError(err.message); //handles any connection/server errors
            } finally {
                setLoading(false) //stop the loading spinner
            }
        };

        fetchData();
    }, []) // this empty arrya ensures this runs exactly once when the page load

    //delete function to remove an item from the list

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this item?")) {
            return; // Exit if the user cancels the deletion
        }
        try {
            const response = await fetch(`http://localhost:8080/api/V1/notes/${id}/`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`DELETE FAILED. status: ${response.status}`);
            }
            // Update the local state to remove the deleted item
            setData(data.filter(item => item.id !== id));

        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) return <div className="landingPage"><h1>Loading...</h1></div>
    if (error) return <div className="landingPage"><div className="error-message">Error: {error}</div></div>

    return (
        <div className="landingPage">
            <Link className="link" to="/">Landing Page</Link>
            <h1>Notes</h1>
            <p>This is a simple Notes app.</p>

            <Link to="/add_note" className="link">
                + Add New Notes
            </Link>

            <div className="data">
                {data.length > 0 ? (
                    data.map(item => (
                        <div className="info" key={item.id}>

                            <Link to={`/view_note/${item.id}`} className="cardContentLink">
                                <div className="cardContent">
                                    <div className="name">{item.notes_name}</div>
                                    <div className="description">{item.notes}</div>
                                </div>
                            </Link>

                            <div className="cardActions">
                                <Link to={`/edit_note/${item.id}`} className="cardBtn editBtn">
                                    Edit
                                </Link>
                                <button onClick={() => handleDelete(item.id)} className="cardBtn deleteBtn">
                                    Delete
                                </button>
                            </div>
                        </div>
                ))
            ) : (
                <div className="emptyStateCard">
                    <div className="emptyStateIcon">// SYSTEM_EMPTY</div>
                    <h2 className="emptyStateTitle">No Notes Available</h2>
                    <p className="emptyStateText">There are no notes to display. Please add some notes.</p>
                </div>
            )}
            </div>


        </div>
    );
}
 
export default NotePage;